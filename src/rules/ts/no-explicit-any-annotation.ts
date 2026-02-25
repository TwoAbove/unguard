import * as ts from "typescript";
import type { TSRule, TSVisitContext } from "../types.ts";

export const noExplicitAnyAnnotation: TSRule = {
  kind: "ts",
  id: "no-explicit-any-annotation",
  severity: "error",
  message: "Explicit `any` annotation erases type safety; use a specific type, `unknown`, or a generic",

  visit(node: ts.Node, ctx: TSVisitContext) {
    if (node.kind !== ts.SyntaxKind.AnyKeyword) return;
    if (node.parent && ts.isAsExpression(node.parent)) return;
    ctx.report(node);
  },
};
