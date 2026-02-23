import type { Node } from "oxc-parser";
import type { SingleFileRule, VisitContext } from "../types.ts";

export const noNonNullAssertion: SingleFileRule = {
  id: "no-non-null-assertion",
  severity: "warning",
  message: "Non-null assertion (!) bypasses type safety; prove the value exists instead",

  visit(node: Node, _parent: Node | null, ctx: VisitContext) {
    if (node.type !== "TSNonNullExpression") return;
    ctx.report(node);
  },
};
