import type { Node, Comment } from "oxc-parser";
import type { SingleFileRule, VisitContext } from "../types.ts";

export const noTsIgnore: SingleFileRule = {
  id: "no-ts-ignore",
  severity: "error",
  message: "@ts-ignore / @ts-expect-error suppresses type checking; fix the underlying type issue",

  visit(_node: Node, _parent: Node | null, _ctx: VisitContext) {},

  visitComment(comment: Comment, ctx: VisitContext) {
    if (comment.value.includes("@ts-ignore") || comment.value.includes("@ts-expect-error")) {
      ctx.report(comment);
    }
  },
};
