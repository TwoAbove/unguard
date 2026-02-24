import type { Node } from "oxc-parser";
import type { SingleFileRule, VisitContext } from "../types.ts";
import { prop, child } from "../../utils/narrow.ts";

export const noDoubleNegationCoercion: SingleFileRule = {
  id: "no-double-negation-coercion",
  severity: "info",
  message: "!! coercion hides intent; use an explicit check (!== null, !== undefined, .length > 0) so the condition documents what it tests",

  visit(node: Node, _parent: Node | null, ctx: VisitContext) {
    if (node.type !== "UnaryExpression") return;
    if (prop<string>(node, "operator") !== "!") return;
    const arg = child(node, "argument");
    if (arg !== null && arg.type === "UnaryExpression" && prop<string>(arg, "operator") === "!") {
      ctx.report(node);
    }
  },
};
