import * as ts from "typescript";
import type { TSRule, TSVisitContext } from "../types.ts";
import { isNullishLiteral, splitEqualityOperands } from "../../typecheck/utils.ts";

/**
 * Fires when a function returns a variable that was bound via array destructure
 * from an array-typed source, AND the declared return type doesn't admit
 * `undefined`. The destructured element is `T | undefined` at runtime
 * (without `noUncheckedIndexedAccess`), so the declared return type is a lie.
 *
 * Skipped when:
 *   - the source is a tuple type (element presence is guaranteed)
 *   - the declared return type already includes undefined (honest)
 *   - a terminating nullish guard or reassignment intervenes before the return
 */
export const returnTypeWidensViaDestructure: TSRule = {
  kind: "ts",
  id: "return-type-widens-via-destructure",
  severity: "warning",
  message:
    "Return value comes from an array destructure, but the declared return type doesn't include undefined. The destructured element is T | undefined; widen the return type or guard before returning.",
  syntaxKinds: [ts.SyntaxKind.ReturnStatement],
  requiresStrictNullChecks: true,

  visit(node: ts.Node, ctx: TSVisitContext) {
    if (!ts.isReturnStatement(node)) return;
    if (node.expression === undefined) return;
    if (!ts.isIdentifier(node.expression)) return;

    const enclosingFn = findEnclosingFunction(node);
    if (enclosingFn === null) return;
    if (enclosingFn.type === undefined) return; // no explicit return annotation; nothing to lie about

    const declaredReturn = unwrapPromise(
      ctx.semantics.typeFromTypeNode(enclosingFn.type),
      ctx,
    );
    if (typeIncludesUndefined(declaredReturn)) return;

    const symbol = ctx.semantics.symbolAtLocation(node.expression);
    if (symbol === undefined) return;
    const declaration = symbol.valueDeclaration;
    if (declaration === undefined) return;
    if (!ts.isBindingElement(declaration)) return;

    const parentBindingPattern = declaration.parent;
    if (!ts.isArrayBindingPattern(parentBindingPattern)) return;

    const variableDecl = parentBindingPattern.parent;
    if (!ts.isVariableDeclaration(variableDecl)) return;
    if (variableDecl.initializer === undefined) return;

    // Source must be array-typed (not tuple, not iterable-with-known-length).
    const sourceType = ctx.semantics.typeAtLocation(variableDecl.initializer);
    if (!ctx.semantics.isArrayType(sourceType)) return;
    if (ctx.semantics.isTupleType(sourceType)) return;

    // Only runtime proof that executes before the return defuses the widening.
    if (hasInterveningGuardOrReassign(declaration, node, symbol, ctx)) return;

    ctx.report(node);
  },
};

function findEnclosingFunction(node: ts.Node): ts.SignatureDeclaration | null {
  let current: ts.Node | undefined = node.parent;
  while (current) {
    if (
      ts.isFunctionDeclaration(current) ||
      ts.isFunctionExpression(current) ||
      ts.isArrowFunction(current) ||
      ts.isMethodDeclaration(current)
    ) {
      return current;
    }
    current = current.parent;
  }
  return null;
}

function unwrapPromise(type: ts.Type, ctx: TSVisitContext): ts.Type {
  const awaited = ctx.semantics.awaitedType(type);
  return awaited ?? type;
}

function typeIncludesUndefined(type: ts.Type): boolean {
  if ((type.flags & ts.TypeFlags.Undefined) !== 0) return true;
  if (type.isUnion()) {
    return type.types.some((t) => (t.flags & ts.TypeFlags.Undefined) !== 0);
  }
  return false;
}

/**
 * Walks statements from the array destructure up to the return and looks for
 * proof that the destructured value can no longer be undefined at the return:
 * a reassignment, or a nullish guard whose nullish branch terminates.
 */
function hasInterveningGuardOrReassign(
  bindingDecl: ts.BindingElement,
  returnStmt: ts.ReturnStatement,
  symbol: ts.Symbol,
  ctx: TSVisitContext,
): boolean {
  const variableStatement = findEnclosingVariableStatement(bindingDecl);
  if (variableStatement === null) return false;

  const containingBlock = variableStatement.parent;
  if (!ts.isBlock(containingBlock) && !ts.isSourceFile(containingBlock)) return false;

  const returnOwner = directChildStatementContaining(returnStmt, containingBlock);
  if (returnOwner === null) return false;

  const statements = containingBlock.statements;
  const start = statements.indexOf(variableStatement);
  const end = statements.indexOf(returnOwner);
  if (start < 0 || end < 0 || end <= start) return false;

  for (let i = start + 1; i < end; i++) {
    const stmt = statements[i];
    if (stmt !== undefined && containsDefusingProof(stmt, symbol, ctx)) return true;
  }
  return false;
}

function findEnclosingVariableStatement(node: ts.Node): ts.VariableStatement | null {
  let current: ts.Node | undefined = node;
  while (current) {
    if (ts.isVariableStatement(current)) return current;
    current = current.parent;
  }
  return null;
}

function directChildStatementContaining(
  node: ts.Node,
  block: ts.Block | ts.SourceFile,
): ts.Statement | null {
  let current: ts.Node = node;
  while (current.parent !== undefined && current.parent !== block) {
    current = current.parent;
  }
  return ts.isStatement(current) ? current : null;
}

function containsDefusingProof(node: ts.Node, symbol: ts.Symbol, ctx: TSVisitContext): boolean {
  let found = false;
  function walk(n: ts.Node): void {
    if (found) return;
    if (
      ts.isFunctionDeclaration(n) ||
      ts.isFunctionExpression(n) ||
      ts.isArrowFunction(n) ||
      ts.isMethodDeclaration(n)
    ) {
      return;
    }
    if (isReassignOf(n, symbol, ctx)) {
      found = true;
      return;
    }
    if (ts.isIfStatement(n) && nullishBranchTerminates(n, symbol, ctx)) {
      found = true;
      return;
    }
    ts.forEachChild(n, walk);
  }
  walk(node);
  return found;
}

function isReassignOf(node: ts.Node, symbol: ts.Symbol, ctx: TSVisitContext): boolean {
  if (!ts.isBinaryExpression(node)) return false;
  const op = node.operatorToken.kind;
  if (
    op !== ts.SyntaxKind.EqualsToken &&
    op !== ts.SyntaxKind.QuestionQuestionEqualsToken &&
    op !== ts.SyntaxKind.BarBarEqualsToken &&
    op !== ts.SyntaxKind.AmpersandAmpersandEqualsToken
  ) {
    return false;
  }
  if (!ts.isIdentifier(node.left)) return false;
  return ctx.semantics.symbolAtLocation(node.left) === symbol;
}

function nullishBranchTerminates(stmt: ts.IfStatement, symbol: ts.Symbol, ctx: TSVisitContext): boolean {
  const branch = nullishBranch(stmt.expression, symbol, ctx);
  if (branch === null) return false;
  if (branch === "then") return statementTerminates(stmt.thenStatement);
  return stmt.elseStatement !== undefined && statementTerminates(stmt.elseStatement);
}

function nullishBranch(
  test: ts.Expression,
  symbol: ts.Symbol,
  ctx: TSVisitContext,
): "then" | "else" | null {
  if (ts.isParenthesizedExpression(test)) return nullishBranch(test.expression, symbol, ctx);
  if (ts.isPrefixUnaryExpression(test) && test.operator === ts.SyntaxKind.ExclamationToken) {
    if (ts.isIdentifier(test.operand) && ctx.semantics.symbolAtLocation(test.operand) === symbol) {
      return "then";
    }
    return null;
  }
  if (ts.isIdentifier(test)) {
    return ctx.semantics.symbolAtLocation(test) === symbol ? "else" : null;
  }
  if (ts.isBinaryExpression(test)) {
    const op = test.operatorToken.kind;
    if (
      op === ts.SyntaxKind.EqualsEqualsEqualsToken ||
      op === ts.SyntaxKind.ExclamationEqualsEqualsToken ||
      op === ts.SyntaxKind.EqualsEqualsToken ||
      op === ts.SyntaxKind.ExclamationEqualsToken
    ) {
      const operands = splitEqualityOperands(test);
      if (operands === null) return null;
      if (ctx.semantics.symbolAtLocation(operands.id) !== symbol) return null;
      if (!isNullishLiteral(operands.lit)) return null;
      if (
        op === ts.SyntaxKind.EqualsEqualsEqualsToken ||
        op === ts.SyntaxKind.EqualsEqualsToken
      ) {
        return "then";
      }
      return "else";
    }
  }
  return null;
}

function statementTerminates(stmt: ts.Statement): boolean {
  if (ts.isReturnStatement(stmt) || ts.isThrowStatement(stmt)) return true;
  if (ts.isBlock(stmt)) {
    const last = stmt.statements.at(-1);
    return last !== undefined && statementTerminates(last);
  }
  if (ts.isIfStatement(stmt)) {
    return stmt.elseStatement !== undefined &&
      statementTerminates(stmt.thenStatement) &&
      statementTerminates(stmt.elseStatement);
  }
  return false;
}
