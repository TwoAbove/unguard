import type { Node } from "oxc-parser";
import type { SingleFileRule, VisitContext } from "../types.ts";

export const noDynamicImport: SingleFileRule = {
  id: "no-dynamic-import",
  severity: "warning",
  message: "Dynamic import() breaks static analysis and hides dependencies; use a static import instead",

  visit(node: Node, _parent: Node | null, ctx: VisitContext) {
    if (node.type !== "ImportExpression") return;
    ctx.report(node);
  },
};
