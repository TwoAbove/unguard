import * as ts from "typescript";
import type { TSRule, TSVisitContext } from "../types.ts";

export const noNullishCoalescing: TSRule = {
  kind: "ts",
  id: "no-nullish-coalescing",
  severity: "warning",
  message: "Nullish coalescing (??) fallback on a non-nullable type is dead code; remove the fallback or fix the type upstream",
  syntaxKinds: [ts.SyntaxKind.BinaryExpression],

  visit(node: ts.Node, ctx: TSVisitContext) {
    if (!ts.isBinaryExpression(node)) return;
    if (node.operatorToken.kind !== ts.SyntaxKind.QuestionQuestionToken) return;
    if (isPossiblyMissingArrayBindingValue(node.left, ctx)) return;
    if (ctx.isNullable(node.left)) return;
    ctx.report(node);
  },
};

function isPossiblyMissingArrayBindingValue(node: ts.Node, ctx: TSVisitContext): boolean {
  if (!ts.isIdentifier(node)) return false;

  const symbol = ctx.semantics.symbolAtLocation(node);
  if (!symbol) return false;

  for (const declaration of symbol.declarations ?? []) {
    if (!ts.isBindingElement(declaration)) continue;
    if (declaration.initializer || declaration.dotDotDotToken) continue;
    if (!ts.isArrayBindingPattern(declaration.parent)) continue;

    const pattern = declaration.parent;
    const index = pattern.elements.indexOf(declaration);
    if (index < 0) continue;

    if (!isTupleSlotDefinitelyPresent(ctx.semantics.typeAtLocation(pattern), index, ctx)) {
      // Without noUncheckedIndexedAccess, TS treats `[x] = T[]` as `x: T`, even though runtime can produce undefined.
      return true;
    }
  }

  return false;
}

function isTupleSlotDefinitelyPresent(type: ts.Type, index: number, ctx: TSVisitContext): boolean {
  if (type.isUnion()) {
    return type.types.every((member) => isTupleSlotDefinitelyPresent(member, index, ctx));
  }

  const apparent = ctx.semantics.apparentType(type);
  if (!isTupleTypeReference(apparent, ctx)) return false;
  return index < apparent.target.minLength;
}

function isTupleTypeReference(type: ts.Type, ctx: TSVisitContext): type is ts.TupleTypeReference {
  if (!ctx.semantics.isTupleType(type)) return false;
  if (!("target" in type)) return false;

  const target = type.target;
  if (typeof target !== "object" || target === null) return false;
  if (!("minLength" in target)) return false;

  return typeof target.minLength === "number";
}
