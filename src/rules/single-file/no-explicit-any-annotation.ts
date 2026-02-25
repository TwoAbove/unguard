import type { Node } from "oxc-parser";
import type { SingleFileRule, VisitContext } from "../types.ts";

export const noExplicitAnyAnnotation: SingleFileRule = {
  id: "no-explicit-any-annotation",
  severity: "error",
  message: "Explicit `any` annotation erases type safety; use a specific type, `unknown`, or a generic",

  visit(node: Node, parent: Node | null, ctx: VisitContext) {
    if (node.type !== "TSAnyKeyword") return;
    // Skip if inside a cast (covered by no-any-cast)
    if (parent !== null && parent.type === "TSAsExpression") return;
    ctx.report(node);
  },
};
