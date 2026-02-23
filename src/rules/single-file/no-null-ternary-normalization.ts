import type { Node } from "oxc-parser";
import type { SingleFileRule, VisitContext } from "../types.ts";
import { prop, child } from "../../utils/narrow.ts";
import { isNullish } from "../../utils/ast.ts";

export const noNullTernaryNormalization: SingleFileRule = {
  id: "no-null-ternary-normalization",
  severity: "warning",
  message: "Ternary null-normalization (x == null ? fallback : x) implies the value could be nullish; prove the shape",

  visit(node: Node, _parent: Node | null, ctx: VisitContext) {
    if (node.type !== "ConditionalExpression") return;
    const test = child(node, "test");
    if (test === null || test.type !== "BinaryExpression") return;
    const op = prop<string>(test, "operator");
    if (op !== "===" && op !== "!==" && op !== "==" && op !== "!=") return;
    const testLeft = child(test, "left");
    const testRight = child(test, "right");
    const hasNullishComparand =
      (testLeft !== null && isNullish(testLeft)) || (testRight !== null && isNullish(testRight));
    if (!hasNullishComparand) return;
    const consequent = child(node, "consequent");
    const alternate = child(node, "alternate");
    if ((consequent !== null && isNullish(consequent)) || (alternate !== null && isNullish(alternate))) {
      ctx.report(node);
    }
  },
};
