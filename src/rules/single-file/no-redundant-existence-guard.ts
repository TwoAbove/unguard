import type { Node } from "oxc-parser";
import type { SingleFileRule, VisitContext } from "../types.ts";
import { child, prop } from "../../utils/narrow.ts";

export const noRedundantExistenceGuard: SingleFileRule = {
  id: "no-redundant-existence-guard",
  severity: "warning",
  message: "Redundant existence guard (obj && obj.prop); if obj is typed, the guard is unnecessary",

  visit(node: Node, _parent: Node | null, ctx: VisitContext) {
    if (node.type !== "IfStatement") return;
    const test = child(node, "test");
    if (!test || test.type !== "LogicalExpression" || prop<string>(test, "operator") !== "&&") return;

    const left = child(test, "left");
    const right = child(test, "right");
    if (!left || left.type !== "Identifier") return;
    if (!right || right.type !== "MemberExpression") return;
    const obj = child(right, "object");
    if (!obj || obj.type !== "Identifier") return;
    if (prop<string>(left, "name") !== prop<string>(obj, "name")) return;
    ctx.report(node);
  },
};
