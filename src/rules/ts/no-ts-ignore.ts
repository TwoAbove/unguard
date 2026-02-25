import * as ts from "typescript";
import type { TSRule, TSVisitContext } from "../types.ts";

export const noTsIgnore: TSRule = {
  kind: "ts",
  id: "no-ts-ignore",
  severity: "error",
  message: "@ts-ignore / @ts-expect-error suppresses type checking; fix the underlying type issue",

  visit(node: ts.Node, ctx: TSVisitContext) {
    const ranges = ts.getLeadingCommentRanges(ctx.source, node.getFullStart());
    if (!ranges) return;
    for (const range of ranges) {
      const text = ctx.source.slice(range.pos, range.end);
      if (text.includes("@ts-ignore") || text.includes("@ts-expect-error")) {
        ctx.reportAtOffset(range.pos);
      }
    }
  },
};
