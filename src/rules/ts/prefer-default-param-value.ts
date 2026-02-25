import * as ts from "typescript";
import type { TSRule, TSVisitContext } from "../types.ts";

export const preferDefaultParamValue: TSRule = {
  kind: "ts",
  id: "prefer-default-param-value",
  severity: "info",
  message: "Use a default parameter value instead of reassigning from nullish coalescing inside the body",

  visit(node: ts.Node, ctx: TSVisitContext) {
    if (!ts.isFunctionDeclaration(node) && !ts.isArrowFunction(node)) return;
    if (!node.body || !ts.isBlock(node.body)) return;
    const stmts = node.body.statements;
    if (stmts.length === 0) return;

    const firstStmt = stmts[0];
    if (firstStmt === undefined || !ts.isExpressionStatement(firstStmt)) return;
    const expr = firstStmt.expression;
    if (!ts.isBinaryExpression(expr) || expr.operatorToken.kind !== ts.SyntaxKind.EqualsToken) return;

    const right = expr.right;
    if (!ts.isBinaryExpression(right) || right.operatorToken.kind !== ts.SyntaxKind.QuestionQuestionToken) return;

    if (!ts.isIdentifier(expr.left) || !ts.isIdentifier(right.left)) return;
    if (expr.left.text !== right.left.text) return;

    const paramName = expr.left.text;
    const isParam = node.parameters.some((p) => ts.isIdentifier(p.name) && p.name.text === paramName);
    if (isParam) ctx.report(firstStmt);
  },
};
