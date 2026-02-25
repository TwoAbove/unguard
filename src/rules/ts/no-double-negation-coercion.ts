import * as ts from "typescript";
import type { TSRule, TSVisitContext } from "../types.ts";
import { includesBooleanType } from "../../typecheck/utils.ts";

export const noDoubleNegationCoercion: TSRule = {
  kind: "ts",
  id: "no-double-negation-coercion",
  severity: "info",
  message: "!! coercion hides intent; use an explicit check (!== null, !== undefined, .length > 0) so the condition documents what it tests",

  visit(node: ts.Node, ctx: TSVisitContext) {
    if (!ts.isPrefixUnaryExpression(node)) return;
    if (node.operator !== ts.SyntaxKind.ExclamationToken) return;
    const inner = node.operand;
    if (!ts.isPrefixUnaryExpression(inner)) return;
    if (inner.operator !== ts.SyntaxKind.ExclamationToken) return;

    const operand = inner.operand;

    // Already boolean -> !! is a no-op, promote severity
    const innerType = ctx.checker.getTypeAtLocation(operand);
    if (includesBooleanType(innerType) && !(innerType.flags & ts.TypeFlags.Union)) {
      ctx.report(node, "!! on an already-boolean type is a no-op; remove the double negation");
      return;
    }

    // Bitwise expression: !!(flags & MASK) is the standard idiom for flag testing
    if (isBitwiseExpression(operand)) return;

    ctx.report(node);
  },
};

const BITWISE_OPS = new Set([
  ts.SyntaxKind.AmpersandToken,
  ts.SyntaxKind.BarToken,
  ts.SyntaxKind.CaretToken,
  ts.SyntaxKind.LessThanLessThanToken,
  ts.SyntaxKind.GreaterThanGreaterThanToken,
  ts.SyntaxKind.GreaterThanGreaterThanGreaterThanToken,
]);

function isBitwiseExpression(node: ts.Node): boolean {
  // Direct: !!(a & b)
  if (ts.isBinaryExpression(node) && BITWISE_OPS.has(node.operatorToken.kind)) return true;
  // Parenthesized: !!((a & b) | c)
  if (ts.isParenthesizedExpression(node)) return isBitwiseExpression(node.expression);
  return false;
}
