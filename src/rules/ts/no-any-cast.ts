import * as ts from "typescript";
import type { TSRule, TSVisitContext } from "../types.ts";

export const noAnyCast: TSRule = {
  kind: "ts",
  id: "no-any-cast",
  severity: "error",
  message: "Casting to `any` erases type safety; use a specific type or generic instead",

  visit(node: ts.Node, ctx: TSVisitContext) {
    if (!ts.isAsExpression(node)) return;
    if (node.type.kind !== ts.SyntaxKind.AnyKeyword) return;
    ctx.report(node);
  },
};
