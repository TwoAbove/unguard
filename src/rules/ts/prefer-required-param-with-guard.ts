import * as ts from "typescript";
import type { TSRule, TSVisitContext } from "../types.ts";
import { getFirstFunctionStatement } from "../../typecheck/utils.ts";

export const preferRequiredParamWithGuard: TSRule = {
  kind: "ts",
  id: "prefer-required-param-with-guard",
  severity: "info",
  message: "Optional param with immediate guard (if (!param) return/throw); make it required instead",

  visit(node: ts.Node, ctx: TSVisitContext) {
    const result = getFirstFunctionStatement(node);
    if (result === null) return;
    const { firstStmt, fn } = result;

    if (!ts.isIfStatement(firstStmt)) return;

    const test = firstStmt.expression;
    let guardedName: string | null = null;

    // Pattern 1: if (!param)
    if (ts.isPrefixUnaryExpression(test) && test.operator === ts.SyntaxKind.ExclamationToken) {
      if (ts.isIdentifier(test.operand)) guardedName = test.operand.text;
    }
    // Pattern 2: if (param === undefined)
    if (ts.isBinaryExpression(test)) {
      const op = test.operatorToken.kind;
      if (op === ts.SyntaxKind.EqualsEqualsEqualsToken || op === ts.SyntaxKind.EqualsEqualsToken) {
        if (ts.isIdentifier(test.left) && ts.isIdentifier(test.right) && test.right.text === "undefined") {
          guardedName = test.left.text;
        }
      }
    }

    if (!guardedName) return;

    const consequent = firstStmt.thenStatement;
    const isGuard =
      ts.isReturnStatement(consequent) ||
      ts.isThrowStatement(consequent) ||
      (ts.isBlock(consequent) &&
        consequent.statements.length === 1 &&
        consequent.statements[0] !== undefined &&
        (ts.isReturnStatement(consequent.statements[0]) || ts.isThrowStatement(consequent.statements[0])));

    if (!isGuard) return;

    const isOptional = fn.parameters.some(
      (p) => ts.isIdentifier(p.name) && p.name.text === guardedName && p.questionToken !== undefined,
    );
    if (isOptional) ctx.report(firstStmt);
  },
};
