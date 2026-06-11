import * as ts from "typescript";
import type { TSRule, TSVisitContext } from "../types.ts";
import { reportDeadQuestionDot } from "./optional-chain.ts";

export const noOptionalCall: TSRule = {
  kind: "ts",
  id: "no-optional-call",
  severity: "warning",
  message: "Optional call (?.) on a non-nullable function is redundant; call directly or fix the type upstream",
  syntaxKinds: [ts.SyntaxKind.CallExpression],
  requiresStrictNullChecks: true,

  visit(node: ts.Node, ctx: TSVisitContext) {
    if (!ts.isCallExpression(node)) return;
    reportDeadQuestionDot(node, "", ctx);
  },
};
