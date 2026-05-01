import * as ts from "typescript";
import type { TSRule, TSVisitContext } from "../types.ts";

export const noNullTernaryNormalization: TSRule = {
  kind: "ts",
  id: "no-null-ternary-normalization",
  severity: "warning",
  message: "Ternary null-normalization (x == null ? fallback : x); if the type guarantees non-null, remove the ternary; if not, fix the type upstream",
  syntaxKinds: [ts.SyntaxKind.ConditionalExpression],

  visit(node: ts.Node, ctx: TSVisitContext) {
    if (!ts.isConditionalExpression(node)) return;
    const test = node.condition;
    if (!ts.isBinaryExpression(test)) return;

    const op = test.operatorToken.kind;
    if (
      op !== ts.SyntaxKind.EqualsEqualsEqualsToken &&
      op !== ts.SyntaxKind.ExclamationEqualsEqualsToken &&
      op !== ts.SyntaxKind.EqualsEqualsToken &&
      op !== ts.SyntaxKind.ExclamationEqualsToken
    ) return;

    const hasNullishComparand = isNullish(test.left) || isNullish(test.right);
    if (!hasNullishComparand) return;

    if (isNullish(node.whenTrue) || isNullish(node.whenFalse)) {
      // Non-nullable tested value -> this is dead code
      const tested = isNullish(test.left) ? test.right : test.left;
      if (!ctx.isNullable(tested)) {
        ctx.report(node, "Ternary null-normalization on a non-nullable type is dead code; remove the ternary");
        return;
      }
      ctx.report(node);
    }
  },
};

function isNullish(node: ts.Node): boolean {
  if (node.kind === ts.SyntaxKind.NullKeyword) return true;
  if (ts.isIdentifier(node) && node.text === "undefined") return true;
  // void 0
  if (ts.isVoidExpression(node)) return true;
  return false;
}
