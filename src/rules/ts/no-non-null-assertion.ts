import * as ts from "typescript";
import type { TSRule, TSVisitContext } from "../types.ts";

export const noNonNullAssertion: TSRule = {
  kind: "ts",
  id: "no-non-null-assertion",
  severity: "warning",
  message: "Non-null assertion (!) overrides the type checker; narrow with a type guard or fix the type so it's not nullable",

  visit(node: ts.Node, ctx: TSVisitContext) {
    if (!ts.isNonNullExpression(node)) return;

    const inner = node.expression;

    // Type already non-nullable -> ! is redundant noise, not worth flagging
    if (!ctx.isNullable(inner)) return;

    // External library type gap -> suppress
    if (ctx.isExternal(inner)) return;

    // split(...)[n]! — always safe
    if (isSplitElementAccess(inner)) return;

    // filter(...)[n]! — safe pattern (narrowed array)
    if (isFilterElementAccess(inner)) return;

    // arr[n]! after a length guard — provably safe
    if (isLengthGuardedAccess(inner)) return;

    ctx.report(node);
  },
};

function isSplitElementAccess(node: ts.Node): boolean {
  if (!ts.isElementAccessExpression(node)) return false;
  const obj = node.expression;
  if (!ts.isCallExpression(obj)) return false;
  const callee = obj.expression;
  if (!ts.isPropertyAccessExpression(callee)) return false;
  return callee.name.text === "split";
}

function isFilterElementAccess(node: ts.Node): boolean {
  // Direct: items.filter(...)[n]!
  if (ts.isElementAccessExpression(node)) {
    const obj = node.expression;
    if (ts.isCallExpression(obj)) {
      const callee = obj.expression;
      if (ts.isPropertyAccessExpression(callee) && callee.name.text === "filter") return true;
    }
    // Indirect: const filtered = items.filter(...); filtered[n]!
    if (ts.isIdentifier(obj)) {
      const init = findVariableInit(obj);
      if (init && ts.isCallExpression(init)) {
        const callee = init.expression;
        if (ts.isPropertyAccessExpression(callee) && callee.name.text === "filter") return true;
      }
    }
  }
  return false;
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
    if (isLengthAccess(expr.left, arrName) && isNumericLiteralValue(expr.right, 0)) return true;
    if (isLengthAccess(expr.right, arrName) && isNumericLiteralValue(expr.left, 0)) return true;
  }

  // arr.length < 1  (or any N >= 1)
  if (op === ts.SyntaxKind.LessThanToken) {
    if (isLengthAccess(expr.left, arrName) && isNumericLiteralGte(expr.right, 1)) return true;
  }

  // arr.length !== N where N >= 1 (e.g., if (arr.length !== 1) return; arr[0]!)
  if ((op === ts.SyntaxKind.ExclamationEqualsEqualsToken || op === ts.SyntaxKind.ExclamationEqualsToken)) {
    if (isLengthAccess(expr.left, arrName) && isNumericLiteralGte(expr.right, 1)) return true;
  }

  return false;
}

/** Checks if condition means "arr is non-empty": arr.length > 0, arr.length !== 0, arr.length >= 1 */
function isPositiveLengthCheck(expr: ts.Expression, arrName: string): boolean {
  if (!ts.isBinaryExpression(expr)) return false;
  const op = expr.operatorToken.kind;

  // arr.length > 0
  if (op === ts.SyntaxKind.GreaterThanToken) {
    if (isLengthAccess(expr.left, arrName) && isNumericLiteralValue(expr.right, 0)) return true;
  }

  // arr.length >= 1
  if (op === ts.SyntaxKind.GreaterThanEqualsToken) {
    if (isLengthAccess(expr.left, arrName) && isNumericLiteralGte(expr.right, 1)) return true;
  }

  // arr.length !== 0
  if ((op === ts.SyntaxKind.ExclamationEqualsEqualsToken || op === ts.SyntaxKind.ExclamationEqualsToken)) {
    if (isLengthAccess(expr.left, arrName) && isNumericLiteralValue(expr.right, 0)) return true;
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

function isNumericLiteralValue(node: ts.Node, value: number): boolean {
  return ts.isNumericLiteral(node) && node.text === String(value);
}

function isNumericLiteralGte(node: ts.Node, min: number): boolean {
  return ts.isNumericLiteral(node) && Number(node.text) >= min;
}

function getIdentifierName(node: ts.Node): string | null {
  if (ts.isIdentifier(node)) return node.text;
  return null;
}

function findVariableInit(id: ts.Identifier): ts.Expression | undefined {
  const sourceFile = id.getSourceFile();
  let result: ts.Expression | undefined;
  function visit(node: ts.Node): void {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === id.text && node.initializer) {
      result = node.initializer;
    }
    if (!result) ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return result;
}
