import * as ts from "typescript";
import type { TSRule, TSVisitContext } from "../types.ts";
import { reportDeadQuestionDot } from "./optional-chain.ts";

export const noOptionalElementAccess: TSRule = {
  kind: "ts",
  id: "no-optional-element-access",
  severity: "warning",
  message: "Optional element access (?.[]) on a non-nullable type is redundant; use direct access or fix the type upstream",
  syntaxKinds: [ts.SyntaxKind.ElementAccessExpression],
  requiresStrictNullChecks: true,

  visit(node: ts.Node, ctx: TSVisitContext) {
    if (!ts.isElementAccessExpression(node)) return;
    reportDeadQuestionDot(node, "", ctx);
  },
};
