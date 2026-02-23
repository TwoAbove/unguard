import type { Node } from "oxc-parser";
import type { SingleFileRule, VisitContext } from "../types.ts";
import { child } from "../../utils/narrow.ts";

export const noTypeAssertion: SingleFileRule = {
  id: "no-type-assertion",
  severity: "warning",
  message: "Double type assertion (`as unknown as T`) circumvents the type system; fix the upstream type or use a type guard",

  visit(node: Node, _parent: Node | null, ctx: VisitContext) {
    if (node.type !== "TSAsExpression") return;
    // Check if the expression being cast is itself an `as unknown`
    const inner = child(node, "expression");
    if (inner === null || inner.type !== "TSAsExpression") return;
    const innerType = child(inner, "typeAnnotation");
    if (innerType === null || innerType.type !== "TSUnknownKeyword") return;
    ctx.report(node);
  },
};
