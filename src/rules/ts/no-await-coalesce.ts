import * as ts from "typescript";
import type { TSRule, TSVisitContext } from "../types.ts";

export const noAwaitCoalesce: TSRule = {
  kind: "ts",
  id: "no-await-coalesce",
  severity: "warning",
  message:
    "?? on a value whose nullability comes from a call's return type collapses failure modes; check the result and branch instead of defaulting",
  syntaxKinds: [ts.SyntaxKind.BinaryExpression],

  visit(node: ts.Node, ctx: TSVisitContext) {
    if (!ts.isBinaryExpression(node)) return;
    if (node.operatorToken.kind !== ts.SyntaxKind.QuestionQuestionToken) return;

    const walk = walkLeftChain(node.left);
    if (!walk || !walk.call) return;

    const sig = ctx.semantics.resolvedSignature(walk.call);
    if (!sig) return;

    // Built-in container APIs (Map.get, Array.find, ts.forEachChild, etc.) use
    // `T | undefined` to encode "not present" — that's structural absence by design,
    // not a fallible operation. Only flag user-defined calls.
    const declSourceFile = sig.declaration?.getSourceFile();
    if (
      declSourceFile &&
      (declSourceFile.isDeclarationFile || declSourceFile.fileName.includes("/node_modules/"))
    ) {
      return;
    }

    let returnType = sig.getReturnType();
    if (walk.awaited) {
      const awaitedType = ctx.semantics.awaitedType(returnType);
      if (awaitedType) returnType = awaitedType;
    }

    const includesNull = typeIncludes(returnType, ts.TypeFlags.Null);
    const includesUndefined = typeIncludes(returnType, ts.TypeFlags.Undefined | ts.TypeFlags.Void);

    // Optional chains in the LHS contribute `undefined` structurally — that's not
    // call-derived nullability. Only flag undefined-only return types when no chain
    // is present; flag null-bearing return types regardless (null doesn't come from `?.`).
    if (walk.optionalChain) {
      if (!includesNull) return;
    } else {
      if (!includesNull && !includesUndefined) return;
    }

    ctx.report(node);
  },
};

interface ChainWalk {
  call: ts.CallExpression | null;
  awaited: boolean;
  optionalChain: boolean;
}

/**
 * Walk an expression tree from the outside in, collecting chain properties.
 * Pass-throughs: parens, await, property access, element access, non-null assertion.
 * Stops at the first call (returning it) or at any non-passthrough shape.
 */
function walkLeftChain(expr: ts.Expression): ChainWalk | null {
  const result: ChainWalk = { call: null, awaited: false, optionalChain: false };
  let cur: ts.Node = expr;
  for (;;) {
    while (ts.isParenthesizedExpression(cur)) cur = cur.expression;
    if (ts.isCallExpression(cur)) {
      if (cur.questionDotToken !== undefined) result.optionalChain = true;
      result.call = cur;
      return result;
    }
    if (ts.isAwaitExpression(cur)) {
      result.awaited = true;
      cur = cur.expression;
      continue;
    }
    if (ts.isPropertyAccessExpression(cur)) {
      if (cur.questionDotToken !== undefined) result.optionalChain = true;
      cur = cur.expression;
      continue;
    }
    if (ts.isElementAccessExpression(cur)) {
      if (cur.questionDotToken !== undefined) result.optionalChain = true;
      cur = cur.expression;
      continue;
    }
    if (ts.isNonNullExpression(cur)) {
      cur = cur.expression;
      continue;
    }
    return null;
  }
}

function typeIncludes(type: ts.Type, mask: number): boolean {
  if (type.isUnion()) return type.types.some((t) => (t.flags & mask) !== 0);
  return (type.flags & mask) !== 0;
}
