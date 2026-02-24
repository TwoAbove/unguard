import type { Node } from "oxc-parser";
import type { SingleFileRule, VisitContext } from "../types.ts";
import { prop } from "../../utils/narrow.ts";

export const noOptionalElementAccess: SingleFileRule = {
  id: "no-optional-element-access",
  severity: "warning",
  message: "Optional element access (?.[]) assumes the object could be nullish; if the type guarantees it, use a direct access; if not, fix the type upstream",

  visit(node: Node, _parent: Node | null, ctx: VisitContext) {
    if (node.type !== "MemberExpression") return;
    if (prop<boolean>(node, "optional") && prop<boolean>(node, "computed")) {
      ctx.report(node);
    }
  },
};
