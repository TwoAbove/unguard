import * as ts from "typescript";
import type { TSRule, TSVisitContext } from "../types.ts";
import { getFirstFunctionStatement } from "../../typecheck/utils.ts";

export const preferDefaultParamValue: TSRule = {
  kind: "ts",
  id: "prefer-default-param-value",
  severity: "info",
  message: "Use a default parameter value instead of reassigning from nullish coalescing inside the body",

  visit(node: ts.Node, ctx: TSVisitContext) {
    const result = getFirstFunctionStatement(node);
    if (result === null) return;
    const { firstStmt, fn } = result;

    if (!ts.isExpressionStatement(firstStmt)) return;
    const expr = firstStmt.expression;
    if (!ts.isBinaryExpression(expr) || expr.operatorToken.kind !== ts.SyntaxKind.EqualsToken) return;

    const right = expr.right;
    if (!ts.isBinaryExpression(right) || right.operatorToken.kind !== ts.SyntaxKind.QuestionQuestionToken) return;

    if (!ts.isIdentifier(expr.left) || !ts.isIdentifier(right.left)) return;
    if (expr.left.text !== right.left.text) return;

    const paramName = expr.left.text;
    const isParam = fn.parameters.some((p) => ts.isIdentifier(p.name) && p.name.text === paramName);
    if (isParam) ctx.report(firstStmt);
  },
};
