import * as ts from "typescript";
import type { TSRule, TSVisitContext } from "../types.ts";

export const noNullishCoalescing: TSRule = {
  kind: "ts",
  id: "no-nullish-coalescing",
  severity: "warning",
  message: "Nullish coalescing (??) on a non-nullable type is unreachable; remove the fallback or fix the type upstream",

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

  const symbol = ctx.checker.getSymbolAtLocation(node);
  if (!symbol) return false;

  for (const declaration of symbol.declarations ?? []) {
    if (!ts.isBindingElement(declaration)) continue;
    if (declaration.initializer || declaration.dotDotDotToken) continue;
    if (!ts.isArrayBindingPattern(declaration.parent)) continue;

    const pattern = declaration.parent;
    const index = pattern.elements.indexOf(declaration);
    if (index < 0) continue;

    if (!isTupleSlotDefinitelyPresent(ctx.checker.getTypeAtLocation(pattern), index, ctx.checker)) {
      // Without noUncheckedIndexedAccess, TS treats `[x] = T[]` as `x: T`, even though runtime can produce undefined.
      return true;
    }
  }

  return false;
}

function isTupleSlotDefinitelyPresent(type: ts.Type, index: number, checker: ts.TypeChecker): boolean {
  if (type.isUnion()) {
    return type.types.every((member) => isTupleSlotDefinitelyPresent(member, index, checker));
  }

  const apparent = checker.getApparentType(type);
  if (!checker.isTupleType(apparent)) return false;
  return index < apparent.target.minLength;
}
