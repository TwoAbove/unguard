import * as ts from "typescript";
import type { TSRule, TSVisitContext } from "../types.ts";

export const noNeverCast: TSRule = {
  kind: "ts",
  id: "no-never-cast",
  severity: "warning",
  message:
    "Casting to `never` silences the type checker completely; use a specific type or a type guard",

  visit(node: ts.Node, ctx: TSVisitContext) {
    if (!ts.isAsExpression(node)) return;
    if (node.type.kind !== ts.SyntaxKind.NeverKeyword) return;
    ctx.report(node);
  },
};
