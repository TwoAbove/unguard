import * as ts from "typescript";
import type { TSRule, TSVisitContext } from "../types.ts";

export const noOptionalPropertyAccess: TSRule = {
  kind: "ts",
  id: "no-optional-property-access",
  severity: "warning",
  message: "Optional chaining (?.) on a non-nullable type is redundant; use direct access or fix the type upstream",

  visit(node: ts.Node, ctx: TSVisitContext) {
    if (!ts.isPropertyAccessExpression(node)) return;
    if (!node.questionDotToken) return;
    if (ctx.isNullable(node.expression)) return;
    ctx.report(node);
  },
};
