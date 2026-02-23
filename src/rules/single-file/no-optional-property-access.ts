import type { Node } from "oxc-parser";
import type { SingleFileRule, VisitContext } from "../types.ts";
import { prop } from "../../utils/narrow.ts";

export const noOptionalPropertyAccess: SingleFileRule = {
  id: "no-optional-property-access",
  severity: "warning",
  message: "Optional chaining (?.) implies the object could be nullish; prove the shape instead",

  visit(node: Node, _parent: Node | null, ctx: VisitContext) {
    if (node.type !== "MemberExpression") return;
    if (prop<boolean>(node, "optional") && !prop<boolean>(node, "computed")) {
      ctx.report(node);
    }
  },
};
