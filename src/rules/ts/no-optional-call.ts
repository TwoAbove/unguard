import * as ts from "typescript";
import type { TSRule, TSVisitContext } from "../types.ts";

export const noOptionalCall: TSRule = {
  kind: "ts",
  id: "no-optional-call",
  severity: "warning",
  message: "Optional call (?.) on a non-nullable function is redundant; call directly or fix the type upstream",
  syntaxKinds: [ts.SyntaxKind.CallExpression],

  visit(node: ts.Node, ctx: TSVisitContext) {
    if (!ts.isCallExpression(node)) return;
    if (!node.questionDotToken) return;
    if (ctx.isNullable(node.expression)) return;
    ctx.report(node);
  },
};
