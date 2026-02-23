import type { Node } from "oxc-parser";
import type { SingleFileRule, VisitContext } from "../types.ts";
import { prop, child, children } from "../../utils/narrow.ts";

export const preferDefaultParamValue: SingleFileRule = {
  id: "prefer-default-param-value",
  severity: "warning",
  message: "Use a default parameter value instead of reassigning from nullish coalescing inside the body",

  visit(node: Node, _parent: Node | null, ctx: VisitContext) {
    if (node.type !== "FunctionDeclaration" && node.type !== "ArrowFunctionExpression") return;
    const params = children(node, "params");
    const body = child(node, "body");
    if (body === null || body.type !== "BlockStatement") return;
    const stmts = children(body, "body");
    if (stmts.length === 0) return;

    const firstStmt = stmts[0];
    if (firstStmt.type !== "ExpressionStatement") return;
    const expr = child(firstStmt, "expression");
    if (expr === null || expr.type !== "AssignmentExpression" || prop<string>(expr, "operator") !== "=") return;

    const right = child(expr, "right");
    if (right === null || right.type !== "LogicalExpression" || prop<string>(right, "operator") !== "??") return;

    const assignee = child(expr, "left");
    const coalescedLeft = child(right, "left");
    if (assignee === null || assignee.type !== "Identifier") return;
    if (coalescedLeft === null || coalescedLeft.type !== "Identifier") return;
    if (prop<string>(assignee, "name") !== prop<string>(coalescedLeft, "name")) return;

    const assigneeName = prop<string>(assignee, "name");
    const isParam = params.some((p: Node) => {
      if (p.type === "Identifier") return prop<string>(p, "name") === assigneeName;
      if (p.type === "AssignmentPattern") {
        const left = child(p, "left");
        return left !== null && left.type === "Identifier" && prop<string>(left, "name") === assigneeName;
      }
      return false;
    });
    if (isParam) {
      ctx.report(firstStmt);
    }
  },
};
