import type * as ts from "typescript";
import type { TSVisitContext } from "../types.ts";
import { isUncheckedIndexRead } from "../../typecheck/utils.ts";

/**
 * Shared core of the dead-`?.` rules: report the question-dot when the
 * receiver's type can never be nullish. `removalText` is what the fix leaves
 * behind (`"."` for property access, `""` for element access and calls).
 */
export function reportDeadQuestionDot(
  node: ts.PropertyAccessExpression | ts.ElementAccessExpression | ts.CallExpression,
  removalText: string,
  ctx: TSVisitContext,
): void {
  if (!node.questionDotToken) return;
  if (isUncheckedIndexRead(node.expression, ctx.semantics, ctx.compilerOptions)) return;
  if (ctx.isNullable(node.expression)) return;
  ctx.report(node, undefined, {
    start: node.questionDotToken.getStart(ctx.sourceFile),
    end: node.questionDotToken.getEnd(),
    text: removalText,
  });
}
