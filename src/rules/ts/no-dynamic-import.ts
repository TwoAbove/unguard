import * as ts from "typescript";
import type { TSRule, TSVisitContext } from "../types.ts";

// warning, not error: import() is the only code-splitting mechanism and the
// standard lazy-load for heavy optional deps — a flat error would just train
// users to turn the rule off.
export const noDynamicImport: TSRule = {
  kind: "ts",
  id: "no-dynamic-import",
  severity: "warning",
  message: "Dynamic import() breaks static analysis and hides dependencies; use a static import instead",
  syntaxKinds: [ts.SyntaxKind.CallExpression],
  requiresTypeInfo: false,

  visit(node: ts.Node, ctx: TSVisitContext) {
    if (!ts.isCallExpression(node)) return;
    if (node.expression.kind !== ts.SyntaxKind.ImportKeyword) return;
    ctx.report(node);
  },
};
