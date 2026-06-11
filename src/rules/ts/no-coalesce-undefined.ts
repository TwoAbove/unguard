import * as ts from "typescript";
import type { TSRule, TSVisitContext } from "../types.ts";

/**
 * `x ?? undefined` where `x` can be undefined but never null: the expression
 * maps undefined to undefined — an identity no-op. Only meaningful when the
 * left side can be null (it normalizes null to undefined); when the left side
 * is not nullable at all, `no-nullish-coalescing` owns the diagnostic.
 */
export const noCoalesceUndefined: TSRule = {
  kind: "ts",
  id: "no-coalesce-undefined",
  severity: "warning",
  message: "?? undefined is an identity no-op here: the value can be undefined but never null",
  syntaxKinds: [ts.SyntaxKind.BinaryExpression],
  requiresStrictNullChecks: true,

  visit(node: ts.Node, ctx: TSVisitContext) {
    if (!ts.isBinaryExpression(node)) return;
    if (node.operatorToken.kind !== ts.SyntaxKind.QuestionQuestionToken) return;

    // The replacement value must itself be plain `undefined` (covers the
    // identifier, `void 0`, and constants typed undefined).
    const rhsType = ctx.semantics.typeAtLocation(node.right);
    if (rhsType.flags !== ts.TypeFlags.Undefined) return;

    const lhsType = ctx.semantics.typeAtLocation(node.left);
    const parts = lhsType.isUnion() ? lhsType.types : [lhsType];
    if (parts.some((p) => (p.flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown | ts.TypeFlags.Instantiable)) !== 0)) {
      return;
    }
    const hasUndefined = parts.some((p) => (p.flags & (ts.TypeFlags.Undefined | ts.TypeFlags.Void)) !== 0);
    const hasNull = parts.some((p) => (p.flags & ts.TypeFlags.Null) !== 0);
    if (!hasUndefined || hasNull) return;

    ctx.report(node, undefined, {
      start: node.getStart(ctx.sourceFile),
      end: node.getEnd(),
      text: node.left.getText(ctx.sourceFile),
    });
  },
};
