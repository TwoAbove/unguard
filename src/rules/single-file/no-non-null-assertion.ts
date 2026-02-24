import type { Node } from "oxc-parser";
import type { SingleFileRule, VisitContext } from "../types.ts";

export const noNonNullAssertion: SingleFileRule = {
  id: "no-non-null-assertion",
  severity: "warning",
  message: "Non-null assertion (!) overrides the type checker; narrow with a type guard or fix the type so it's not nullable",

  visit(node: Node, _parent: Node | null, ctx: VisitContext) {
    if (node.type !== "TSNonNullExpression") return;
    ctx.report(node);
  },
};
