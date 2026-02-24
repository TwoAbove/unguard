import type { Node } from "oxc-parser";
import type { SingleFileRule, VisitContext } from "../types.ts";
import { prop } from "../../utils/narrow.ts";

export const noOptionalPropertyAccess: SingleFileRule = {
  id: "no-optional-property-access",
  severity: "warning",
  message: "Optional chaining (?.) assumes the object could be nullish; if the type guarantees it, use a direct access; if not, fix the type upstream",

  visit(node: Node, _parent: Node | null, ctx: VisitContext) {
    if (node.type !== "MemberExpression") return;
    if (prop<boolean>(node, "optional") && !prop<boolean>(node, "computed")) {
      ctx.report(node);
    }
  },
};
