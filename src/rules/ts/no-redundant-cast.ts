import * as ts from "typescript";
import type { TSRule, TSVisitContext } from "../types.ts";

export const noRedundantCast: TSRule = {
  kind: "ts",
  id: "no-redundant-cast",
  severity: "error",
  message:
    "Type assertion is redundant; the expression already has this type",
  syntaxKinds: [ts.SyntaxKind.AsExpression],

  visit(node: ts.Node, ctx: TSVisitContext) {
    if (!ts.isAsExpression(node)) return;

    // skip `as const`
    if (
      ts.isTypeReferenceNode(node.type) &&
      node.type.getText(ctx.sourceFile).trim() === "const"
    ) {
      return;
    }

    const exprType = ctx.semantics.typeAtLocation(node.expression);

    // `any` is bidirectionally assignable to everything — these casts carry intent, not redundancy
    if (exprType.flags & ts.TypeFlags.Any) return;

    const targetType = ctx.semantics.typeFromTypeNode(node.type);

    // Redundant if both directions are assignable (types are equivalent)
    if (
      ctx.semantics.isTypeAssignableTo(exprType, targetType) &&
      ctx.semantics.isTypeAssignableTo(targetType, exprType)
    ) {
      ctx.report(node);
    }
  },
};
