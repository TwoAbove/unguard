import * as ts from "typescript";
import type { TSRule, TSVisitContext } from "../types.ts";
import { libDeclaredSignature } from "../../typecheck/utils.ts";

export const noNonNullAssertion: TSRule = {
  kind: "ts",
  id: "no-non-null-assertion",
  severity: "warning",
  message: "Non-null assertion (!) overrides the type checker; narrow with a type guard or fix the type so it's not nullable",
  syntaxKinds: [ts.SyntaxKind.NonNullExpression],
  requiresStrictNullChecks: true,

  visit(node: ts.Node, ctx: TSVisitContext) {
    if (!ts.isNonNullExpression(node)) return;

    const inner = node.expression;

    // Type already non-nullable -> ! is redundant noise, not worth flagging
    if (!ctx.isNullable(inner)) return;

    // External library type gap -> suppress
    if (ctx.isExternal(inner)) return;

    // First element of a string split — the one index a split guarantees
    if (isGuaranteedFirstSplitElement(inner, ctx)) return;

    // arr[n]! after a length guard — provably safe
    if (isLengthGuardedAccess(inner)) return;

    ctx.report(node);
  },
};

/**
 * `str.split(sep)[0]!` — String.prototype.split always yields at least one
 * element, so index 0 is present. Matched structurally, not by method name:
 * a lib-declared method on a string receiver returning string[], indexed
 * with the literal 0. Indexes past 0 carry no such guarantee and are flagged.
 */
function isGuaranteedFirstSplitElement(node: ts.Node, ctx: TSVisitContext): boolean {
  if (!ts.isElementAccessExpression(node)) return false;
  const indexArg = node.argumentExpression;
  if (!ts.isNumericLiteral(indexArg) || indexArg.text !== "0") return false;

  const call = node.expression;
  if (!ts.isCallExpression(call)) return false;
  if (!ts.isPropertyAccessExpression(call.expression)) return false;

  const signature = libDeclaredSignature(call, ctx.semantics);
  if (signature === null) return false;

  const receiverType = ctx.semantics.typeAtLocation(call.expression.expression);
  if (!isStringLike(receiverType)) return false;

  const returnType = signature.getReturnType();
  if (!ctx.semantics.isArrayType(returnType)) return false;
  const elementType = ctx.checker.getTypeArguments(returnType as ts.TypeReference)[0];
  return elementType !== undefined && isStringLike(elementType);
}

function isStringLike(type: ts.Type): boolean {
  if (type.isUnion()) return type.types.every(isStringLike);
  return (type.flags & ts.TypeFlags.StringLike) !== 0;
}

/** Detect arr[n]! where arr.length is checked in a preceding guard or enclosing for-loop. */
function isLengthGuardedAccess(node: ts.Node): boolean {
  if (!ts.isElementAccessExpression(node)) return false;
  const arr = node.expression;

  const arrName = getIdentifierName(arr);
  if (!arrName) return false;

  // Check for enclosing for-loop: for (let i = 0; i < arr.length; i++)
  if (isInsideForLoopBoundedBy(node, arrName)) return true;

  // Check for preceding length guard in same block
  return hasPrecedingLengthGuard(node, arrName);
}

/** Walk ancestors to find a for-loop whose condition bounds against arrName.length. */
function isInsideForLoopBoundedBy(node: ts.Node, arrName: string): boolean {
  let current: ts.Node = node;
  while (current.parent) {
    current = current.parent;
    if (ts.isForStatement(current) && current.condition) {
      if (isLengthBoundCondition(current.condition, arrName)) return true;
    }
  }
  return false;
}

/** Check if a condition is `i < arr.length` or similar. */
function isLengthBoundCondition(cond: ts.Expression, arrName: string): boolean {
  if (!ts.isBinaryExpression(cond)) return false;
  const op = cond.operatorToken.kind;
  // i < arr.length or i <= arr.length - 1
  if (op === ts.SyntaxKind.LessThanToken || op === ts.SyntaxKind.LessThanEqualsToken) {
    return isLengthAccess(cond.right, arrName);
  }
  // arr.length > i
  if (op === ts.SyntaxKind.GreaterThanToken || op === ts.SyntaxKind.GreaterThanEqualsToken) {
    return isLengthAccess(cond.left, arrName);
  }
  return false;
}

/** Check if node is `arrName.length`. */
function isLengthAccess(node: ts.Node, arrName: string): boolean {
  if (!ts.isPropertyAccessExpression(node)) return false;
  if (node.name.text !== "length") return false;
  return getIdentifierName(node.expression) === arrName;
}

/**
 * Check if there's a preceding statement in the same block (or a parent block)
 * that guards on arrName.length, implying the array is non-empty.
 *
 * Patterns:
 * - if (arr.length === 0) return;
 * - if (arr.length < N) return;   (where N >= 1)
 * - if (arr.length > 0) { ... arr[0]! ... }
 * - if (arr.length !== 0) { ... arr[0]! ... }
 * - if (arr.length >= 1) { ... arr[0]! ... }
 * - if (arr.length !== N) return;  (where N >= 1)
 */
function hasPrecedingLengthGuard(node: ts.Node, arrName: string): boolean {
  // Walk up to find the containing block/if-statement
  let current: ts.Node = node;
  while (current.parent) {
    const parent = current.parent;

    // Case 1: we're in a block and a preceding if-statement guards length with early return
    if (ts.isBlock(parent)) {
      for (const stmt of parent.statements) {
        if (stmt === current || stmt.pos >= current.pos) break;
        if (ts.isIfStatement(stmt) && isLengthGuardWithEarlyExit(stmt, arrName)) return true;
      }
    }

    // Case 2: we're inside the then-branch of an if that checks length > 0
    if (ts.isIfStatement(parent) && parent.thenStatement === current) {
      if (isPositiveLengthCheck(parent.expression, arrName)) return true;
    }
    // Also handle: if (...) { <block containing current> }
    if (ts.isBlock(current) && ts.isIfStatement(parent) && parent.thenStatement === current) {
      if (isPositiveLengthCheck(parent.expression, arrName)) return true;
    }

    current = parent;
  }
  return false;
}

/** if (arr.length === 0) return/throw; or if (arr.length < 1) return/throw; etc. */
function isLengthGuardWithEarlyExit(stmt: ts.IfStatement, arrName: string): boolean {
  if (!isEarlyExit(stmt.thenStatement)) return false;
  return isZeroLengthCheck(stmt.expression, arrName);
}

/** Checks if condition means "arr is empty": arr.length === 0, arr.length < 1, arr.length !== N (N>=1) */
function isZeroLengthCheck(expr: ts.Expression, arrName: string): boolean {
  if (!ts.isBinaryExpression(expr)) return false;
  const op = expr.operatorToken.kind;

  // arr.length === 0
  if ((op === ts.SyntaxKind.EqualsEqualsEqualsToken || op === ts.SyntaxKind.EqualsEqualsToken)) {
    if (isLengthAccess(expr.left, arrName) && isZeroLiteral(expr.right)) return true;
    if (isLengthAccess(expr.right, arrName) && isZeroLiteral(expr.left)) return true;
  }

  // arr.length < 1  (or any N >= 1)
  if (op === ts.SyntaxKind.LessThanToken) {
    if (isLengthAccess(expr.left, arrName) && isPositiveIntLiteral(expr.right)) return true;
  }

  // arr.length !== N where N >= 1 (e.g., if (arr.length !== 1) return; arr[0]!)
  if ((op === ts.SyntaxKind.ExclamationEqualsEqualsToken || op === ts.SyntaxKind.ExclamationEqualsToken)) {
    if (isLengthAccess(expr.left, arrName) && isPositiveIntLiteral(expr.right)) return true;
  }

  return false;
}

/** Checks if condition means "arr is non-empty": arr.length > 0, arr.length !== 0, arr.length >= 1 */
function isPositiveLengthCheck(expr: ts.Expression, arrName: string): boolean {
  if (!ts.isBinaryExpression(expr)) return false;
  const op = expr.operatorToken.kind;

  // arr.length > 0
  if (op === ts.SyntaxKind.GreaterThanToken) {
    if (isLengthAccess(expr.left, arrName) && isZeroLiteral(expr.right)) return true;
  }

  // arr.length >= 1
  if (op === ts.SyntaxKind.GreaterThanEqualsToken) {
    if (isLengthAccess(expr.left, arrName) && isPositiveIntLiteral(expr.right)) return true;
  }

  // arr.length !== 0
  if ((op === ts.SyntaxKind.ExclamationEqualsEqualsToken || op === ts.SyntaxKind.ExclamationEqualsToken)) {
    if (isLengthAccess(expr.left, arrName) && isZeroLiteral(expr.right)) return true;
  }

  return false;
}

function isEarlyExit(stmt: ts.Statement): boolean {
  if (ts.isReturnStatement(stmt) || ts.isThrowStatement(stmt)) return true;
  if (ts.isBlock(stmt) && stmt.statements.length === 1) {
    const inner = stmt.statements[0];
    if (inner === undefined) return false;
    return ts.isReturnStatement(inner) || ts.isThrowStatement(inner);
  }
  return false;
}

function isZeroLiteral(node: ts.Node): boolean {
  return ts.isNumericLiteral(node) && node.text === "0";
}

function isPositiveIntLiteral(node: ts.Node): boolean {
  return ts.isNumericLiteral(node) && Number(node.text) >= 1;
}

function getIdentifierName(node: ts.Node): string | null {
  if (ts.isIdentifier(node)) return node.text;
  return null;
}
