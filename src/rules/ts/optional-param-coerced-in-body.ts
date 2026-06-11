import * as ts from "typescript";
import type { TSRule, TSVisitContext } from "../types.ts";
import { getFunctionBodyStatements, isNullishLiteral, splitEqualityOperands } from "../../typecheck/utils.ts";

/**
 * Optional parameter coerced to non-optional in the function body.
 *
 * Scans the body's prologue (statements before the first other use of the
 * param) for either:
 *   - a reassignment via ??: `param = param ?? X` / `param ??= X`
 *   - a nullish guard that throws: `if (!param) throw`
 *     or `if (param === undefined) throw`
 *
 * AND the parameter is declared optional (`?:`).
 *
 * A nullish guard that returns is an honest no-op optional contract and is not
 * flagged.
 */
export const optionalParamCoercedInBody: TSRule = {
  kind: "ts",
  id: "optional-param-coerced-in-body",
  severity: "warning",
  message:
    "Optional parameter is forced non-optional in the body. Make the contract honest: make it required, use a default value in the signature, or split into a discriminated alternative.",
  syntaxKinds: [
    ts.SyntaxKind.FunctionDeclaration,
    ts.SyntaxKind.ArrowFunction,
    ts.SyntaxKind.FunctionExpression,
    ts.SyntaxKind.MethodDeclaration,
  ],
  requiresTypeInfo: false,

  visit(node: ts.Node, ctx: TSVisitContext) {
    const result = getFunctionBodyStatements(node);
    if (result === null) return;
    const { statements, fn } = result;

    const pending = new Set(
      fn.parameters
        .filter((p) => p.questionToken !== undefined && ts.isIdentifier(p.name))
        .map((p) => (p.name as ts.Identifier).text),
    );
    if (pending.size === 0) return;

    for (const stmt of statements) {
      if (pending.size === 0) return;
      let coerced = detectCoerceReassign(stmt);
      if (coerced === null) coerced = detectNullishGuard(stmt);
      if (coerced !== null && pending.has(coerced)) {
        ctx.report(stmt);
        pending.delete(coerced);
        continue;
      }
      // Any other use of a param ends its prologue: a later coercion no
      // longer describes the parameter's contract, just local logic.
      for (const name of pending) {
        if (statementReferencesName(stmt, name)) pending.delete(name);
      }
    }
  },
};

function statementReferencesName(stmt: ts.Statement, name: string): boolean {
  let found = false;
  function walk(node: ts.Node): void {
    if (found) return;
    if (ts.isIdentifier(node) && node.text === name) {
      found = true;
      return;
    }
    ts.forEachChild(node, walk);
  }
  walk(stmt);
  return found;
}

/** Pattern A: `param = param ?? X` or `param ??= X`. Returns the param name or null. */
function detectCoerceReassign(stmt: ts.Statement): string | null {
  if (!ts.isExpressionStatement(stmt)) return null;
  const expr = stmt.expression;
  if (!ts.isBinaryExpression(expr)) return null;

  // `param ??= X`
  if (expr.operatorToken.kind === ts.SyntaxKind.QuestionQuestionEqualsToken) {
    return ts.isIdentifier(expr.left) ? expr.left.text : null;
  }
  // `param = param ?? X`
  if (expr.operatorToken.kind !== ts.SyntaxKind.EqualsToken) return null;
  if (!ts.isIdentifier(expr.left)) return null;
  const rhs = expr.right;
  if (!ts.isBinaryExpression(rhs)) return null;
  if (rhs.operatorToken.kind !== ts.SyntaxKind.QuestionQuestionToken) return null;
  if (!ts.isIdentifier(rhs.left)) return null;
  if (rhs.left.text !== expr.left.text) return null;
  return expr.left.text;
}

/**
 * Pattern B: `if (NULL-CHECK on param) THROW`. Returns the param name or null.
 * NULL-CHECK is one of: `!param`, `param === undefined`, `param == undefined`,
 * `param === null`, `param == null`.
 */
function detectNullishGuard(stmt: ts.Statement): string | null {
  if (!ts.isIfStatement(stmt)) return null;
  const test = stmt.expression;
  const guardedName = extractNullCheckIdentifier(test);
  if (guardedName === null) return null;

  const consequent = stmt.thenStatement;
  if (!isThrow(consequent)) return null;
  return guardedName;
}

function extractNullCheckIdentifier(test: ts.Expression): string | null {
  // `!param`
  if (ts.isPrefixUnaryExpression(test) && test.operator === ts.SyntaxKind.ExclamationToken) {
    return ts.isIdentifier(test.operand) ? test.operand.text : null;
  }
  // `param === undefined` / `param == undefined` / `param === null` / `param == null`
  if (ts.isBinaryExpression(test)) {
    const op = test.operatorToken.kind;
    if (
      op !== ts.SyntaxKind.EqualsEqualsEqualsToken &&
      op !== ts.SyntaxKind.EqualsEqualsToken
    ) {
      return null;
    }
    const operands = splitEqualityOperands(test);
    if (operands === null) return null;
    if (isNullishLiteral(operands.lit)) return operands.id.text;
  }
  return null;
}

function isThrow(stmt: ts.Statement): boolean {
  if (ts.isThrowStatement(stmt)) return true;
  if (!ts.isBlock(stmt)) return false;
  if (stmt.statements.length !== 1) return false;
  const inner = stmt.statements[0];
  return inner !== undefined && ts.isThrowStatement(inner);
}
