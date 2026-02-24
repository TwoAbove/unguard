import type { Node } from "oxc-parser";
import type { SingleFileRule, VisitContext } from "../types.ts";
import { prop, child } from "../../utils/narrow.ts";
import { isLiteral } from "../../utils/ast.ts";

export const noLogicalOrFallback: SingleFileRule = {
  id: "no-logical-or-fallback",
  severity: "warning",
  message: "|| with a literal fallback assumes the left side could be falsy; if the type guarantees a value, remove the fallback; if not, fix the type upstream",

  visit(node: Node, _parent: Node | null, ctx: VisitContext) {
    if (node.type !== "LogicalExpression") return;
    if (prop<string>(node, "operator") !== "||") return;
    const right = child(node, "right");
    if (right && isLiteral(right)) {
      ctx.report(node);
    }
  },
};
