import * as ts from "typescript";
import type { TSRule, TSVisitContext } from "../types.ts";

export const noDynamicImport: TSRule = {
  kind: "ts",
  id: "no-dynamic-import",
  severity: "error",
  message: "Dynamic import() breaks static analysis and hides dependencies; use a static import instead",
  syntaxKinds: [ts.SyntaxKind.CallExpression],
  requiresTypeInfo: false,

  visit(node: ts.Node, ctx: TSVisitContext) {
    if (!ts.isCallExpression(node)) return;
    if (node.expression.kind !== ts.SyntaxKind.ImportKeyword) return;
    ctx.report(node);
  },
};
