import type { Node } from "oxc-parser";
import type { SingleFileRule, VisitContext } from "../types.ts";
import { prop, child } from "../../utils/narrow.ts";
import { isLiteral } from "../../utils/ast.ts";

export const noLogicalOrFallback: SingleFileRule = {
  id: "no-logical-or-fallback",
  severity: "warning",
  message: "|| with a literal fallback implies the left side could be falsy; prove the shape instead",

  visit(node: Node, _parent: Node | null, ctx: VisitContext) {
    if (node.type !== "LogicalExpression") return;
    if (prop<string>(node, "operator") !== "||") return;
    const right = child(node, "right");
    if (right && isLiteral(right)) {
      ctx.report(node);
    }
  },
};
