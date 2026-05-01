import * as ts from "typescript";
import type { TSRule, TSVisitContext } from "../types.ts";
import { includesNumberType, isNullableType } from "../../typecheck/utils.ts";

export const noLogicalOrFallback: TSRule = {
  kind: "ts",
  id: "no-logical-or-fallback",
  severity: "warning",
  message:
    '|| fallback on a data-structure lookup swallows valid falsy values (0, ""); use ?? to only catch null/undefined',
  syntaxKinds: [ts.SyntaxKind.BinaryExpression],

  visit(node: ts.Node, ctx: TSVisitContext) {
    if (!ts.isBinaryExpression(node)) return;
    if (node.operatorToken.kind !== ts.SyntaxKind.BarBarToken) return;

    const right = node.right;
    if (!isLiteral(right)) return;

    const left = node.left;
    const lhsType = ctx.semantics.typeAtLocation(left);

    // Number() / parseInt() — || catches NaN/0 intentionally, ?? would not help
    if (isNumericCoercionCall(left)) return;

    // String type without undefined: || catches "" intentionally — suppress
    // String | undefined: || swallows "" AND catches undefined — should use ??
    if (isStringNotNullable(lhsType, ctx.semantics.checker)) return;

    // LHS includes number and RHS is not 0 -> catches bugs like `seed || undefined`
    if (includesNumberType(lhsType) && !isZeroLiteral(right)) {
      ctx.report(node, '|| on a numeric type swallows 0; use ?? to only catch null/undefined');
      return;
    }

    // Data-structure lookups: .get(), .find(), x[key], optional chaining
    if (isDataStructureLookup(left)) {
      ctx.report(node);
    }
  },
};

/** LHS is string (or string-like) without null/undefined in the union. */
function isStringNotNullable(type: ts.Type, checker: ts.TypeChecker): boolean {
  if (isNullableType(checker, type)) return false;
  if (type.isUnion()) {
    return type.types.every((t) => (t.flags & ts.TypeFlags.StringLike) !== 0);
  }
  return (type.flags & ts.TypeFlags.StringLike) !== 0;
}

function isLiteral(node: ts.Node): boolean {
  if (ts.isStringLiteral(node) || ts.isNumericLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return true;
  if (ts.isTemplateExpression(node)) return true;
  if (ts.isArrayLiteralExpression(node) || ts.isObjectLiteralExpression(node)) return true;
  if (ts.isIdentifier(node) && node.text === "undefined") return true;
  if (node.kind === ts.SyntaxKind.NullKeyword) return true;
  if (node.kind === ts.SyntaxKind.TrueKeyword || node.kind === ts.SyntaxKind.FalseKeyword) return true;
  return false;
}

/** Number(...) or parseInt(...) — returns number, || catches NaN/0, ?? wouldn't help */
function isNumericCoercionCall(node: ts.Node): boolean {
  if (!ts.isCallExpression(node)) return false;
  if (!ts.isIdentifier(node.expression)) return false;
  const name = node.expression.text;
  return name === "Number" || name === "parseInt" || name === "parseFloat";
}

function isZeroLiteral(node: ts.Node): boolean {
  return ts.isNumericLiteral(node) && node.text === "0";
}

function isDataStructureLookup(left: ts.Node): boolean {
  // Flag: LHS is .get(), .find(), .getStore() call
  if (ts.isCallExpression(left)) {
    const callee = left.expression;
    if (ts.isPropertyAccessExpression(callee)) {
      const methodName = callee.name.text;
      if (methodName === "find" || methodName === "getStore" || methodName === "get") return true;
    }
  }

  // Flag: LHS is computed member expression x[key]
  if (ts.isElementAccessExpression(left)) return true;

  // Flag: LHS contains optional chaining (?.)
  if (hasOptionalChaining(left)) return true;

  return false;
}

function hasOptionalChaining(node: ts.Node): boolean {
  if (ts.isPropertyAccessExpression(node) && node.questionDotToken) return true;
  if (ts.isElementAccessExpression(node) && node.questionDotToken) return true;
  if (ts.isCallExpression(node) && node.questionDotToken) return true;
  if (ts.isPropertyAccessExpression(node)) return hasOptionalChaining(node.expression);
  if (ts.isCallExpression(node)) return hasOptionalChaining(node.expression);
  if (ts.isElementAccessExpression(node)) return hasOptionalChaining(node.expression);
  return false;
}
