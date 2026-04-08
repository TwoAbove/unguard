import * as ts from "typescript";
import type { TSRule, TSVisitContext } from "../types.ts";

function isUntypedSource(type: ts.Type): boolean {
  if (type.flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown)) return true;
  if (type.isUnion()) return type.types.some(isUntypedSource);
  if (type.isIntersection()) return type.types.some(isUntypedSource);
  return false;
}

function isPrimitiveFamily(type: ts.Type, checker: ts.TypeChecker): boolean {
  if (
    type.flags &
    (ts.TypeFlags.String |
      ts.TypeFlags.StringLiteral |
      ts.TypeFlags.Number |
      ts.TypeFlags.NumberLiteral |
      ts.TypeFlags.Boolean |
      ts.TypeFlags.BooleanLiteral |
      ts.TypeFlags.BigInt |
      ts.TypeFlags.BigIntLiteral |
      ts.TypeFlags.ESSymbol |
      ts.TypeFlags.UniqueESSymbol |
      ts.TypeFlags.Void |
      ts.TypeFlags.Undefined |
      ts.TypeFlags.Null |
      ts.TypeFlags.Never)
  ) {
    return true;
  }

  // Branded types like `string & { __brand: "X" }` — check if any intersection member is primitive
  if (type.isIntersection()) {
    return type.types.some((t) => isPrimitiveFamily(t, checker));
  }

  // Unions: all members must be primitive
  if (type.isUnion()) {
    return type.types.every((t) => isPrimitiveFamily(t, checker));
  }

  return false;
}

function isConcreteTarget(
  type: ts.Type,
  checker: ts.TypeChecker,
): boolean {
  if (
    type.flags &
    (ts.TypeFlags.Any |
      ts.TypeFlags.Unknown |
      ts.TypeFlags.Never |
      ts.TypeFlags.Void |
      ts.TypeFlags.Undefined |
      ts.TypeFlags.Null |
      ts.TypeFlags.TypeParameter |
      ts.TypeFlags.NonPrimitive)
  ) {
    return false;
  }

  if (isPrimitiveFamily(type, checker)) return false;

  if (checker.isArrayType(type) || checker.isTupleType(type)) return true;

  const apparent = checker.getApparentType(type);
  if (apparent.getProperties().length > 0) return true;
  if (apparent.getStringIndexType() !== undefined) return true;
  if (apparent.getNumberIndexType() !== undefined) return true;

  // Unions: concrete if any non-null member is concrete
  if (type.isUnion()) {
    return type.types.some((t) => isConcreteTarget(t, checker));
  }

  return false;
}

function isEmptyArrayLiteral(node: ts.Expression): boolean {
  return (
    ts.isArrayLiteralExpression(node) && node.elements.length === 0
  );
}

export const noUnvalidatedCast: TSRule = {
  kind: "ts",
  id: "no-unvalidated-cast",
  severity: "error",
  message:
    "Casting `any`/`unknown` to a concrete type without runtime validation fabricates structure; validate first or narrow with a type guard",

  visit(node: ts.Node, ctx: TSVisitContext) {
    if (!ts.isAsExpression(node) && !ts.isTypeAssertionExpression(node))
      return;

    // skip `as const`
    if (
      ts.isTypeReferenceNode(node.type) &&
      node.type.getText(ctx.sourceFile).trim() === "const"
    ) {
      return;
    }

    const expr = ts.isParenthesizedExpression(node.expression)
      ? node.expression.expression
      : node.expression;

    if (isEmptyArrayLiteral(expr)) return;

    const sourceType = ctx.checker.getTypeAtLocation(expr);
    if (!isUntypedSource(sourceType)) return;

    const targetType = ctx.checker.getTypeFromTypeNode(node.type);
    if (!isConcreteTarget(targetType, ctx.checker)) return;

    ctx.report(node);
  },
};
