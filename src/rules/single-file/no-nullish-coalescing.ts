import type { Node } from "oxc-parser";
import type { SingleFileRule, VisitContext } from "../types.ts";
import { prop } from "../../utils/narrow.ts";

export const noNullishCoalescing: SingleFileRule = {
  id: "no-nullish-coalescing",
  severity: "warning",
  message: "Nullish coalescing (??) implies the value could be null/undefined; prove the shape instead",

  visit(node: Node, _parent: Node | null, ctx: VisitContext) {
    if (node.type !== "LogicalExpression") return;
    if (prop<string>(node, "operator") !== "??") return;
    ctx.report(node);
  },
};
