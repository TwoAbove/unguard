import type { Node } from "oxc-parser";
import type { SingleFileRule, VisitContext } from "../types.ts";
import { prop } from "../../utils/narrow.ts";

export const noOptionalCall: SingleFileRule = {
  id: "no-optional-call",
  severity: "warning",
  message: "Optional call (?.) assumes the function could be undefined; if the type guarantees it exists, call directly; if not, fix the type upstream",

  visit(node: Node, _parent: Node | null, ctx: VisitContext) {
    if (node.type !== "CallExpression") return;
    if (!prop<boolean>(node, "optional")) return;
    ctx.report(node);
  },
};
