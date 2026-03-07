import * as ts from "typescript";
import type { TSRule, TSVisitContext } from "../types.ts";

export const noInlineTypeAssertion: TSRule = {
  kind: "ts",
  id: "no-inline-type-assertion",
  severity: "error",
  message: "Inline object type assertions (`x as { ... }`) hide missing named types; extract a named type or fix the upstream type",

  visit(node: ts.Node, ctx: TSVisitContext) {
    if (ts.isAsExpression(node) && ts.isTypeLiteralNode(node.type)) {
      ctx.report(node);
      return;
    }

    if (ts.isTypeAssertionExpression(node) && ts.isTypeLiteralNode(node.type)) {
      ctx.report(node);
    }
  },
};
