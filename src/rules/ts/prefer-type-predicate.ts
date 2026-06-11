import * as ts from "typescript";
import type { TSRule, TSVisitContext } from "../types.ts";
import { asSignatureLike, isNullishLiteral } from "../../typecheck/utils.ts";

/**
 * Single-param function with a wide param type and a `boolean` return whose
 * body performs structural narrowing on the parameter. Such a function would
 * be strictly more useful as a type predicate (`param is T`) — every caller
 * gains narrowing in the success branch.
 *
 * Fires only when ALL of:
 *   - Function has exactly 1 parameter (excluding rest)
 *   - Parameter has an explicit type annotation
 *   - Parameter type is wide: `unknown`, `any`, or a top-level union with
 *     >= 2 non-nullish constituents
 *   - Return type annotation exists and is exactly `boolean` (NOT a TypePredicate)
 *   - Body's return expression(s) consist of narrowing checks on the parameter
 *     combined via `&&`/`||`: typeof X, X instanceof Y, X === literal, X != null,
 *     "prop" in X, or nested type-predicate calls on X
 */
export const preferTypePredicate: TSRule = {
  kind: "ts",
  id: "prefer-type-predicate",
  severity: "warning",
  message:
    "Function performs structural narrowing on its parameter and returns plain `boolean`. Make it a type predicate (`param is T`) so callers benefit from the narrowing.",
  syntaxKinds: [
    ts.SyntaxKind.FunctionDeclaration,
    ts.SyntaxKind.ArrowFunction,
    ts.SyntaxKind.FunctionExpression,
    ts.SyntaxKind.MethodDeclaration,
  ],

  visit(node: ts.Node, ctx: TSVisitContext) {
    const fn = asSignatureLike(node);
    if (fn === null) return;
    // Exactly one parameter, with an explicit type annotation
    if (fn.parameters.length !== 1) return;
    const param = fn.parameters[0];
    if (param === undefined) return;
    if (param.dotDotDotToken !== undefined) return;
    if (param.type === undefined) return;
    if (!ts.isIdentifier(param.name)) return;
    const paramName = param.name.text;

    // Return type must be explicit and exactly `boolean` (not a predicate already).
    if (fn.type === undefined) return;
    if (ts.isTypePredicateNode(fn.type)) return;
    if (fn.type.kind !== ts.SyntaxKind.BooleanKeyword) return;

    // Param type must be "wide" — unknown/any, or a union of >=2 non-nullish.
    const paramType = ctx.semantics.typeFromTypeNode(param.type);
    if (!isWideParamType(paramType)) return;

    // Every return path must be a structural narrowing on the param.
    if (fn.body === undefined) return;
    if (!everyReturnIsNarrowing(fn.body, paramName, ctx)) return;

    ctx.report(fn);
  },
};

function isWideParamType(type: ts.Type): boolean {
  if ((type.flags & ts.TypeFlags.Unknown) !== 0) return true;
  if ((type.flags & ts.TypeFlags.Any) !== 0) return true;
  if (type.isUnion()) {
    const nonNullish = type.types.filter(
      (t) => (t.flags & (ts.TypeFlags.Null | ts.TypeFlags.Undefined | ts.TypeFlags.Void)) === 0,
    );
    if (nonNullish.length < 2) return false;
    // Skip unions whose members are ALL literal types (string-/number-/enum-literal).
    // Such a function is an enum-membership test; the predicate refactor would
    // produce an anonymous subset type that's more verbose than the original.
    const LITERAL_FLAGS =
      ts.TypeFlags.StringLiteral |
      ts.TypeFlags.NumberLiteral |
      ts.TypeFlags.BooleanLiteral |
      ts.TypeFlags.EnumLiteral |
      ts.TypeFlags.BigIntLiteral |
      ts.TypeFlags.UniqueESSymbol;
    const allLiteral = nonNullish.every((t) => (t.flags & LITERAL_FLAGS) !== 0);
    return !allLiteral;
  }
  return false;
}

/** All return paths must be narrowing predicates on `paramName`. */
function everyReturnIsNarrowing(
  body: ts.Block | ts.Expression,
  paramName: string,
  ctx: TSVisitContext,
): boolean {
  const returnExprs = collectReturnExpressions(body);
  if (returnExprs.length === 0) return false;
  return returnExprs.every((e) => isNarrowingExpression(e, paramName, ctx));
}

/**
 * For a block body, collect the expressions returned by every reachable
 * `return` statement. For an expression body (arrow), return that expression.
 * Skip nested function bodies (their returns belong to a different scope).
 */
function collectReturnExpressions(body: ts.Block | ts.Expression): ts.Expression[] {
  if (!ts.isBlock(body)) return [body];
  const out: ts.Expression[] = [];
  function walk(node: ts.Node): void {
    if (
      ts.isFunctionDeclaration(node) ||
      ts.isFunctionExpression(node) ||
      ts.isArrowFunction(node) ||
      ts.isMethodDeclaration(node)
    ) {
      return;
    }
    if (ts.isReturnStatement(node)) {
      if (node.expression !== undefined) out.push(node.expression);
      return;
    }
    ts.forEachChild(node, walk);
  }
  ts.forEachChild(body, walk);
  return out;
}

/**
 * True if `expr` is a structural narrowing on `paramName`. Recognized patterns:
 *   - typeof X === literal / typeof X !== literal
 *   - X instanceof Y
 *   - X === literal / X !== literal / X == null / X != null
 *   - "prop" in X
 *   - bare X (truthy)
 *   - type-predicate calls whose predicate argument references X
 *   - (a && b), (a || b) where both operands are narrowing expressions
 *   - parenthesized variants
 */
function isNarrowingExpression(expr: ts.Expression, paramName: string, ctx: TSVisitContext): boolean {
  if (ts.isParenthesizedExpression(expr)) return isNarrowingExpression(expr.expression, paramName, ctx);
  if (ts.isBinaryExpression(expr)) {
    const op = expr.operatorToken.kind;
    if (op === ts.SyntaxKind.AmpersandAmpersandToken || op === ts.SyntaxKind.BarBarToken) {
      return isNarrowingExpression(expr.left, paramName, ctx) && isNarrowingExpression(expr.right, paramName, ctx);
    }
    if (
      op === ts.SyntaxKind.EqualsEqualsEqualsToken ||
      op === ts.SyntaxKind.ExclamationEqualsEqualsToken ||
      op === ts.SyntaxKind.EqualsEqualsToken ||
      op === ts.SyntaxKind.ExclamationEqualsToken
    ) {
      return isNarrowingEquality(expr, paramName);
    }
    if (op === ts.SyntaxKind.InstanceOfKeyword) {
      return mentionsParam(expr.left, paramName);
    }
    if (op === ts.SyntaxKind.InKeyword) {
      // `"prop" in X` — narrowing on the right operand
      return mentionsParam(expr.right, paramName);
    }
    return false;
  }
  if (ts.isPrefixUnaryExpression(expr) && expr.operator === ts.SyntaxKind.ExclamationToken) {
    return isNarrowingExpression(expr.operand, paramName, ctx);
  }
  if (ts.isCallExpression(expr)) return isPredicateCallOnParam(expr, paramName, ctx);
  if (ts.isIdentifier(expr) && expr.text === paramName) return true;
  if (ts.isPropertyAccessExpression(expr)) {
    // `expr.length > 0` style — accept truthy probe on the param's property chain
    return mentionsParam(expr, paramName);
  }
  return false;
}

function isPredicateCallOnParam(
  expr: ts.CallExpression,
  paramName: string,
  ctx: TSVisitContext,
): boolean {
  const signature = ctx.semantics.resolvedSignature(expr);
  if (signature === undefined) return false;
  const predicate = ctx.checker.getTypePredicateOfSignature(signature);
  if (predicate === undefined) return false;
  if (predicate.kind !== ts.TypePredicateKind.Identifier) return false;
  const arg = expr.arguments[predicate.parameterIndex];
  if (arg === undefined) return false;
  return mentionsParam(arg, paramName);
}

function isNarrowingEquality(expr: ts.BinaryExpression, paramName: string): boolean {
  const leftMentions = mentionsParam(expr.left, paramName);
  const rightMentions = mentionsParam(expr.right, paramName);
  if (leftMentions === rightMentions) return false;
  const other = leftMentions ? expr.right : expr.left;
  return isNarrowingLiteral(other);
}

function isNarrowingLiteral(expr: ts.Expression): boolean {
  if (ts.isParenthesizedExpression(expr)) return isNarrowingLiteral(expr.expression);
  if (isNullishLiteral(expr)) return true;
  if (ts.isStringLiteral(expr) || ts.isNumericLiteral(expr) || ts.isBigIntLiteral(expr)) return true;
  return expr.kind === ts.SyntaxKind.TrueKeyword || expr.kind === ts.SyntaxKind.FalseKeyword;
}

function mentionsParam(expr: ts.Node, paramName: string): boolean {
  if (ts.isTypeOfExpression(expr)) return mentionsParam(expr.expression, paramName);
  if (ts.isParenthesizedExpression(expr)) return mentionsParam(expr.expression, paramName);
  if (ts.isPropertyAccessExpression(expr)) return mentionsParam(expr.expression, paramName);
  if (ts.isElementAccessExpression(expr)) return mentionsParam(expr.expression, paramName);
  if (ts.isIdentifier(expr)) return expr.text === paramName;
  return false;
}
