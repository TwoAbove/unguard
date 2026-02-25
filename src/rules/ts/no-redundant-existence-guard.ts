import * as ts from "typescript";
import type { TSRule, TSVisitContext } from "../types.ts";
import { isNullishLiteral } from "../../typecheck/utils.ts";

export const noRedundantExistenceGuard: TSRule = {
  kind: "ts",
  id: "no-redundant-existence-guard",
  severity: "warning",
  message: "Redundant existence guard (obj && obj.prop) on a non-nullable type; remove the guard or fix the type upstream",

  visit(node: ts.Node, ctx: TSVisitContext) {
    if (!ts.isBinaryExpression(node)) return;
    if (node.operatorToken.kind !== ts.SyntaxKind.AmpersandAmpersandToken) return;

    const left = node.left;
    const right = node.right;

    // Pattern 1: obj && obj.prop / obj.method() / obj[key]
    if (ts.isIdentifier(left) && accessesIdentifier(right, left.text)) {
      if (ctx.isNullable(left)) return;
      ctx.report(node);
      return;
    }

    // Pattern 2: obj != null && obj.prop (or !== null, !== undefined)
    if (ts.isBinaryExpression(left) && isNullCheck(left)) {
      const checked = getNullCheckedIdentifier(left);
      if (checked && accessesIdentifier(right, checked)) {
        // The null-check LHS is the identifier — check its type before the comparison
        // If the type is non-nullable, the entire guard is redundant
        const identNode = ts.isIdentifier(left.left) ? left.left : left.right;
        if (ts.isIdentifier(identNode) && identNode.text === checked && !ctx.isNullable(identNode)) {
          ctx.report(node);
        }
      }
    }
  },
};

/** Check if the root object of `expr` is identifier `name`. */
function accessesIdentifier(expr: ts.Node, name: string): boolean {
  const root = getExpressionRoot(expr);
  return ts.isIdentifier(root) && root.text === name;
}

/** Walk through property access, element access, and call chains to find the root expression. */
function getExpressionRoot(node: ts.Node): ts.Node {
  if (ts.isPropertyAccessExpression(node)) return getExpressionRoot(node.expression);
  if (ts.isElementAccessExpression(node)) return getExpressionRoot(node.expression);
  if (ts.isCallExpression(node)) return getExpressionRoot(node.expression);
  return node;
}

/** Check if expr is a null/undefined comparison: x != null, x !== null, x !== undefined */
function isNullCheck(expr: ts.BinaryExpression): boolean {
  const op = expr.operatorToken.kind;
  if (op !== ts.SyntaxKind.ExclamationEqualsToken && op !== ts.SyntaxKind.ExclamationEqualsEqualsToken) return false;
  return isNullishLiteral(expr.right) || isNullishLiteral(expr.left);
}

/** Get the identifier name being null-checked. */
function getNullCheckedIdentifier(expr: ts.BinaryExpression): string | null {
  if (ts.isIdentifier(expr.left) && isNullishLiteral(expr.right)) return expr.left.text;
  if (ts.isIdentifier(expr.right) && isNullishLiteral(expr.left)) return expr.right.text;
  return null;
}
