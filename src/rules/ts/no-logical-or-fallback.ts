import * as ts from "typescript";
import type { TSRule, TSVisitContext } from "../types.ts";
import { includesNumberType, isNullableType, isUncheckedIndexRead, libDeclaredSignature } from "../../typecheck/utils.ts";

export const noLogicalOrFallback: TSRule = {
  kind: "ts",
  id: "no-logical-or-fallback",
  severity: "warning",
  message:
    '|| fallback on a nullable value swallows valid falsy values (0, ""); use ?? to only catch null/undefined',
  syntaxKinds: [ts.SyntaxKind.BinaryExpression],
  requiresStrictNullChecks: true,

  visit(node: ts.Node, ctx: TSVisitContext) {
    if (!ts.isBinaryExpression(node)) return;
    if (node.operatorToken.kind !== ts.SyntaxKind.BarBarToken) return;

    const right = node.right;
    if (!isLiteral(right)) return;

    const left = node.left;
    const lhsType = ctx.semantics.typeAtLocation(left);

    // Lib-declared free function returning number (Number, parseInt, ...):
    // || catches NaN/0 intentionally, ?? would not help.
    if (isLibNumericCoercionCall(left, ctx)) return;

    // String type without undefined: || catches "" intentionally — suppress
    // String | undefined: || swallows "" AND catches undefined — should use ??
    if (isStringNotNullable(lhsType, ctx.semantics.checker)) return;

    // LHS includes number and RHS is not 0 -> catches bugs like `seed || undefined`
    if (includesNumberType(lhsType) && !isZeroLiteral(right)) {
      ctx.report(node, "|| on a numeric type swallows 0; use ?? to only catch null/undefined");
      return;
    }

    // Lookup-shaped reads, detected structurally: the absence encoded in the
    // type (or hidden by noUncheckedIndexedAccess) is what the fallback is
    // for, and || conflates absence with falsiness. Plain property reads of
    // `string | undefined` (e.g. env vars, where "" conventionally means
    // "unset") are deliberately not flagged.
    if (isDataStructureLookup(left, lhsType, ctx)) {
      ctx.report(node);
    }
  },
};

function isDataStructureLookup(left: ts.Expression, lhsType: ts.Type, ctx: TSVisitContext): boolean {
  // x[key] / arr[0] — nullable element, or unchecked when noUncheckedIndexedAccess is off
  if (ts.isElementAccessExpression(left)) {
    if (isNullableType(ctx.semantics.checker, lhsType)) return true;
    return isUncheckedIndexRead(left, ctx.semantics, ctx.compilerOptions);
  }

  // a?.b chains contribute undefined structurally
  if (hasOptionalChaining(left)) return true;

  // A call whose declared return type models absence (Map.get, Array.find,
  // any user lookup returning T | undefined or T | null)
  if (ts.isCallExpression(left)) {
    const signature = ctx.semantics.resolvedSignature(left);
    if (signature === undefined) return false;
    return isNullableType(ctx.semantics.checker, signature.getReturnType());
  }

  return false;
}

function hasOptionalChaining(node: ts.Node): boolean {
  if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node) || ts.isCallExpression(node)) {
    if (node.questionDotToken) return true;
    return hasOptionalChaining(node.expression);
  }
  return false;
}

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
  return node.kind === ts.SyntaxKind.TrueKeyword || node.kind === ts.SyntaxKind.FalseKeyword;
}

/**
 * Free function declared in a lib .d.ts returning number — the standard
 * numeric coercions (Number, parseInt, parseFloat). || after these catches
 * NaN and 0 deliberately; ?? wouldn't. Matched by declaration origin and
 * return type, not by callee name.
 */
function isLibNumericCoercionCall(node: ts.Node, ctx: TSVisitContext): boolean {
  if (!ts.isCallExpression(node)) return false;
  if (!ts.isIdentifier(node.expression)) return false;
  const signature = libDeclaredSignature(node, ctx.semantics);
  if (signature === null) return false;
  const returnType = signature.getReturnType();
  return (returnType.flags & ts.TypeFlags.NumberLike) !== 0;
}

function isZeroLiteral(node: ts.Node): boolean {
  return ts.isNumericLiteral(node) && node.text === "0";
}
