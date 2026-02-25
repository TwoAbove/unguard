import * as ts from "typescript";
import type { TSRule, TSVisitContext } from "../types.ts";

export const noEmptyCatch: TSRule = {
  kind: "ts",
  id: "no-empty-catch",
  severity: "error",
  message: "Empty catch blocks hide failures; handle, annotate, or rethrow explicitly",

  visit(node: ts.Node, ctx: TSVisitContext) {
    if (!ts.isCatchClause(node)) return;
    const block = node.block;
    if (block.statements.length > 0) return;

    // Check for comments inside the block braces
    const blockStart = block.getStart(ctx.sourceFile);
    const blockEnd = block.getEnd();
    const inner = ctx.source.slice(blockStart + 1, blockEnd - 1);
    if (inner.includes("//") || inner.includes("/*")) return;

    ctx.report(node);
  },
};
