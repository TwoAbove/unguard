import * as ts from "typescript";
import type { TSRule, TSVisitContext } from "../types.ts";

export const noInlineParamType: TSRule = {
  kind: "ts",
  id: "no-inline-param-type",
  severity: "warning",
  message:
    "Inline object type on parameter; extract to a named type",

  visit(node: ts.Node, ctx: TSVisitContext) {
    if (!ts.isTypeLiteralNode(node)) return;
    const parent = node.parent;
    if (!parent || !ts.isParameter(parent)) return;
    if (parent.type !== node) return;
    ctx.report(node);
  },
};
