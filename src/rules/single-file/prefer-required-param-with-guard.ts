import type { Node } from "oxc-parser";
import type { SingleFileRule, VisitContext } from "../types.ts";
import { prop, child, children } from "../../utils/narrow.ts";

export const preferRequiredParamWithGuard: SingleFileRule = {
  id: "prefer-required-param-with-guard",
  severity: "warning",
  message: "Optional param with immediate guard (if (!param) return/throw); make it required instead",

  visit(node: Node, _parent: Node | null, ctx: VisitContext) {
    if (node.type !== "FunctionDeclaration" && node.type !== "ArrowFunctionExpression") return;
    const params = children(node, "params");
    const body = child(node, "body");
    if (body === null || body.type !== "BlockStatement") return;
    const stmts = children(body, "body");
    if (stmts.length === 0) return;

    const firstStmt = stmts[0];
    if (firstStmt.type !== "IfStatement") return;

    const test = child(firstStmt, "test");
    if (test === null) return;
    let guardedName: string | null = null;

    // Pattern 1: if (!param)
    if (test.type === "UnaryExpression" && prop<string>(test, "operator") === "!") {
      const arg = child(test, "argument");
      if (arg !== null && arg.type === "Identifier") guardedName = prop<string>(arg, "name");
    }
    // Pattern 2: if (param === undefined)
    if (test.type === "BinaryExpression") {
      const op = prop<string>(test, "operator");
      if (op === "===" || op === "==") {
        const left = child(test, "left");
        const right = child(test, "right");
        if (
          left !== null &&
          left.type === "Identifier" &&
          right !== null &&
          right.type === "Identifier" &&
          prop<string>(right, "name") === "undefined"
        ) {
          guardedName = prop<string>(left, "name");
        }
      }
    }

    if (guardedName === null) return;

    const consequent = child(firstStmt, "consequent");
    if (consequent === null) return;
    const isGuard =
      consequent.type === "ReturnStatement" ||
      consequent.type === "ThrowStatement" ||
      (consequent.type === "BlockStatement" && isGuardBlock(consequent));

    if (!isGuard) return;

    const isOptionalParam = params.some(
      (p: Node) => p.type === "Identifier" && prop<string>(p, "name") === guardedName && prop<boolean>(p, "optional") === true,
    );
    if (isOptionalParam) {
      ctx.report(firstStmt);
    }
  },
};

function isGuardBlock(block: Node): boolean {
  const body = children(block, "body");
  if (body.length !== 1) return false;
  const stmt = body[0];
  return stmt.type === "ReturnStatement" || stmt.type === "ThrowStatement";
}
