import * as ts from "typescript";
import type { TSRule, TSVisitContext } from "../types.ts";

type Fallback =
  | { kind: "null" }
  | { kind: "undefined" }
  | { kind: "empty-array" };

export const noCoalesceThenGuard: TSRule = {
  kind: "ts",
  id: "no-coalesce-then-guard",
  severity: "warning",
  message:
    "?? fallback fuses with subsequent guard; the partition is identical to checking the original value directly",
  syntaxKinds: [ts.SyntaxKind.BinaryExpression],
  requiresTypeInfo: false,

  visit(node: ts.Node, ctx: TSVisitContext) {
    if (!ts.isBinaryExpression(node)) return;
    if (node.operatorToken.kind !== ts.SyntaxKind.QuestionQuestionToken) return;

    const decl = getDeclarationContext(node);
    if (!decl) return;

    const fallback = classifyFallback(node.right);
    if (!fallback) return;

    const block = decl.statement.parent;
    if (!ts.isBlock(block) && !ts.isSourceFile(block)) return;
    const stmts = block.statements;
    const idx = stmts.indexOf(decl.statement);
    if (idx < 0) return;

    for (let i = idx + 1; i < stmts.length; i++) {
      const stmt = stmts[i];
      if (stmt === undefined) break;
      if (containsAssignmentTo(stmt, decl.binding)) break;
      if (!ts.isIfStatement(stmt)) continue;
      if (matchesGuard(stmt.expression, decl.binding, fallback)) {
        ctx.report(node);
        return;
      }
    }
  },
};

interface DeclarationContext {
  binding: string;
  statement: ts.VariableStatement;
}

function getDeclarationContext(coalesce: ts.BinaryExpression): DeclarationContext | undefined {
  let cur: ts.Node = coalesce;
  while (cur.parent && ts.isParenthesizedExpression(cur.parent)) cur = cur.parent;
  const decl = cur.parent;
  if (!decl || !ts.isVariableDeclaration(decl)) return undefined;
  if (!ts.isIdentifier(decl.name)) return undefined;
  const list = decl.parent;
  if (!list || !ts.isVariableDeclarationList(list)) return undefined;
  const stmt = list.parent;
  if (!stmt || !ts.isVariableStatement(stmt)) return undefined;
  return { binding: decl.name.text, statement: stmt };
}

function classifyFallback(node: ts.Expression): Fallback | undefined {
  let inner = node;
  while (ts.isParenthesizedExpression(inner)) inner = inner.expression;
  if (inner.kind === ts.SyntaxKind.NullKeyword) return { kind: "null" };
  if (ts.isIdentifier(inner) && inner.text === "undefined") return { kind: "undefined" };
  if (ts.isArrayLiteralExpression(inner) && inner.elements.length === 0) return { kind: "empty-array" };
  return undefined;
}

function matchesGuard(expr: ts.Expression, binding: string, fallback: Fallback): boolean {
  let cond = expr;
  while (ts.isParenthesizedExpression(cond)) cond = cond.expression;
  if (!ts.isBinaryExpression(cond)) return false;

  if (fallback.kind === "null") {
    if (!isEqOp(cond.operatorToken.kind)) return false;
    return matchesSidedLiteral(cond, binding, (n) => n.kind === ts.SyntaxKind.NullKeyword);
  }
  if (fallback.kind === "undefined") {
    if (!isEqOp(cond.operatorToken.kind)) return false;
    return matchesSidedLiteral(cond, binding, (n) => ts.isIdentifier(n) && n.text === "undefined");
  }
  return matchesEmptyArrayPartition(cond, binding);
}

function isEqOp(kind: ts.SyntaxKind): boolean {
  return (
    kind === ts.SyntaxKind.EqualsEqualsEqualsToken ||
    kind === ts.SyntaxKind.EqualsEqualsToken ||
    kind === ts.SyntaxKind.ExclamationEqualsEqualsToken ||
    kind === ts.SyntaxKind.ExclamationEqualsToken
  );
}

function matchesSidedLiteral(
  bin: ts.BinaryExpression,
  binding: string,
  isLit: (n: ts.Node) => boolean,
): boolean {
  if (isIdentifierNamed(bin.left, binding) && isLit(bin.right)) return true;
  if (isIdentifierNamed(bin.right, binding) && isLit(bin.left)) return true;
  return false;
}

function isIdentifierNamed(node: ts.Node, name: string): boolean {
  return ts.isIdentifier(node) && node.text === name;
}

/**
 * binding.length checked against 0/1 in a way that partitions identically to
 * "binding was nullish (and thus the [] fallback ran)" for an empty-array fallback.
 */
function matchesEmptyArrayPartition(cond: ts.BinaryExpression, binding: string): boolean {
  const lengthOnLeft = isLengthAccess(cond.left, binding);
  const lengthOnRight = isLengthAccess(cond.right, binding);
  if (!lengthOnLeft && !lengthOnRight) return false;
  const numNode = lengthOnLeft ? cond.right : cond.left;
  if (!ts.isNumericLiteral(numNode)) return false;
  const n = Number(numNode.text);
  if (Number.isNaN(n)) return false;
  const op = cond.operatorToken.kind;

  if (
    (op === ts.SyntaxKind.EqualsEqualsEqualsToken || op === ts.SyntaxKind.EqualsEqualsToken) &&
    n === 0
  ) {
    return true;
  }
  if (
    (op === ts.SyntaxKind.ExclamationEqualsEqualsToken || op === ts.SyntaxKind.ExclamationEqualsToken) &&
    n === 0
  ) {
    return true;
  }
  if (lengthOnLeft) {
    if (op === ts.SyntaxKind.GreaterThanToken && n === 0) return true;
    if (op === ts.SyntaxKind.GreaterThanEqualsToken && n === 1) return true;
    if (op === ts.SyntaxKind.LessThanToken && n === 1) return true;
  } else {
    if (op === ts.SyntaxKind.LessThanToken && n === 0) return true;
    if (op === ts.SyntaxKind.LessThanEqualsToken && n === 1) return true;
    if (op === ts.SyntaxKind.GreaterThanToken && n === 1) return true;
  }
  return false;
}

function isLengthAccess(node: ts.Node, bindingName: string): boolean {
  if (!ts.isPropertyAccessExpression(node)) return false;
  if (node.name.text !== "length") return false;
  return isIdentifierNamed(node.expression, bindingName);
}

function containsAssignmentTo(stmt: ts.Node, name: string): boolean {
  let found = false;
  function walk(node: ts.Node): void {
    if (found) return;
    if (ts.isBinaryExpression(node) && isAssignmentOp(node.operatorToken.kind)) {
      if (isIdentifierNamed(node.left, name)) {
        found = true;
        return;
      }
    }
    ts.forEachChild(node, walk);
  }
  walk(stmt);
  return found;
}

function isAssignmentOp(kind: ts.SyntaxKind): boolean {
  return (
    kind === ts.SyntaxKind.EqualsToken ||
    kind === ts.SyntaxKind.PlusEqualsToken ||
    kind === ts.SyntaxKind.MinusEqualsToken ||
    kind === ts.SyntaxKind.AsteriskEqualsToken ||
    kind === ts.SyntaxKind.SlashEqualsToken ||
    kind === ts.SyntaxKind.QuestionQuestionEqualsToken ||
    kind === ts.SyntaxKind.BarBarEqualsToken ||
    kind === ts.SyntaxKind.AmpersandAmpersandEqualsToken
  );
}
