import * as ts from "typescript";
import type { TSRule, TSVisitContext } from "../types.ts";
import { includesBooleanType } from "../../typecheck/utils.ts";

export const noDoubleNegationCoercion: TSRule = {
  kind: "ts",
  id: "no-double-negation-coercion",
  severity: "warning",
  message: "!! is noise in a boolean-evaluation context (if/while/ternary test); the surrounding construct already coerces — use the value directly",
  syntaxKinds: [ts.SyntaxKind.PrefixUnaryExpression],

  visit(node: ts.Node, ctx: TSVisitContext) {
    if (!ts.isPrefixUnaryExpression(node)) return;
    if (node.operator !== ts.SyntaxKind.ExclamationToken) return;
    const inner = node.operand;
    if (!ts.isPrefixUnaryExpression(inner)) return;
    if (inner.operator !== ts.SyntaxKind.ExclamationToken) return;

    const operand = inner.operand;
    const fix = {
      start: node.getStart(ctx.sourceFile),
      end: node.getEnd(),
      text: operand.getText(ctx.sourceFile),
    };

    // Already boolean -> !! is a no-op everywhere, not just in eval contexts.
    const innerType = ctx.semantics.typeAtLocation(operand);
    if (includesBooleanType(innerType) && !(innerType.flags & ts.TypeFlags.Union)) {
      ctx.report(node, "!! on an already-boolean type is a no-op; remove the double negation", fix);
      return;
    }

    // Bitwise expression: !!(flags & MASK) is the standard idiom for flag testing
    if (isBitwiseExpression(operand)) return;

    // Only fire when the surrounding context will boolean-coerce the result anyway.
    // Outside such contexts (variable initializers, return values, function args
    // with boolean contextual type, object properties), !! is legitimate boolean
    // production — the user is explicitly producing a boolean for a typed slot.
    if (!isInBooleanEvalContext(node)) return;

    ctx.report(node, undefined, fix);
  },
};

/**
 * True when `node`'s value will be boolean-coerced by its surrounding construct.
 * Walks up through parentheses and short-circuit operators (`&&`/`||`) since the
 * result of those flows to the same enclosing position.
 */
function isInBooleanEvalContext(node: ts.Node): boolean {
  let current: ts.Node = node;
  let parent: ts.Node | undefined = current.parent;
  while (parent) {
    if (ts.isParenthesizedExpression(parent)) {
      current = parent;
      parent = current.parent;
      continue;
    }
    if (ts.isIfStatement(parent) && parent.expression === current) return true;
    if (ts.isWhileStatement(parent) && parent.expression === current) return true;
    if (ts.isDoStatement(parent) && parent.expression === current) return true;
    if (ts.isForStatement(parent) && parent.condition === current) return true;
    if (ts.isConditionalExpression(parent) && parent.condition === current) return true;
    if (ts.isPrefixUnaryExpression(parent) && parent.operator === ts.SyntaxKind.ExclamationToken) return true;
    if (
      ts.isBinaryExpression(parent) &&
      (parent.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken ||
        parent.operatorToken.kind === ts.SyntaxKind.BarBarToken)
    ) {
      // Result of `a && b` / `a || b` flows to the binary expression's enclosing context.
      current = parent;
      parent = current.parent;
      continue;
    }
    return false;
  }
  return false;
}

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
