import type { Node } from "oxc-parser";
import type { SingleFileRule, VisitContext } from "../types.ts";
import { child } from "../../utils/narrow.ts";

export const noAnyCast: SingleFileRule = {
  id: "no-any-cast",
  severity: "error",
  message: "Casting to `any` erases type safety; use a specific type or generic instead",

  visit(node: Node, _parent: Node | null, ctx: VisitContext) {
    if (node.type !== "TSAsExpression") return;
    const typeAnno = child(node, "typeAnnotation");
    if (typeAnno !== null && typeAnno.type === "TSAnyKeyword") {
      ctx.report(node);
    }
  },
};
