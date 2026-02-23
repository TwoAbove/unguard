import type { Node } from "oxc-parser";
import type { SingleFileRule, VisitContext } from "../types.ts";

export const noInlineTypeInParams: SingleFileRule = {
  id: "no-inline-type-in-params",
  severity: "warning",
  message: "Inline type literal in annotation; extract to a named type for reuse and clarity",

  visit(node: Node, parent: Node | null, ctx: VisitContext) {
    if (node.type !== "TSTypeLiteral") return;
    if (parent !== null && parent.type === "TSTypeAnnotation") {
      ctx.report(node);
    }
  },
};
