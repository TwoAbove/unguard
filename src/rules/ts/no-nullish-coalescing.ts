import * as ts from "typescript";
import type { TSRule, TSVisitContext } from "../types.ts";

export const noNullishCoalescing: TSRule = {
  kind: "ts",
  id: "no-nullish-coalescing",
  severity: "warning",
  message: "Nullish coalescing (??) on a non-nullable type is unreachable; remove the fallback or fix the type upstream",

  visit(node: ts.Node, ctx: TSVisitContext) {
    if (!ts.isBinaryExpression(node)) return;
    if (node.operatorToken.kind !== ts.SyntaxKind.QuestionQuestionToken) return;
    if (ctx.isNullable(node.left)) return;
    ctx.report(node);
  },
};
