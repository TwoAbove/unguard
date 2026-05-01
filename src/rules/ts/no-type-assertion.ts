import * as ts from "typescript";
import type { TSRule, TSVisitContext } from "../types.ts";

export const noTypeAssertion: TSRule = {
  kind: "ts",
  id: "no-type-assertion",
  severity: "error",
  message: "Double type assertion (`as unknown as T`) circumvents the type system; fix the upstream type or use a type guard",
  syntaxKinds: [ts.SyntaxKind.AsExpression],
  requiresTypeInfo: false,

  visit(node: ts.Node, ctx: TSVisitContext) {
    if (!ts.isAsExpression(node)) return;
    if (!ts.isAsExpression(node.expression)) return;
    if (node.expression.type.kind !== ts.SyntaxKind.UnknownKeyword) return;
    ctx.report(node);
  },
};
