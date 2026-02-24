import type { Node } from "oxc-parser";
import type { SingleFileRule, VisitContext } from "../types.ts";
import { child, children } from "../../utils/narrow.ts";

export const noEmptyCatch: SingleFileRule = {
  id: "no-empty-catch",
  severity: "error",
  message: "Empty catch blocks hide failures; handle, annotate, or rethrow explicitly",

  visit(node: Node, _parent: Node | null, ctx: VisitContext) {
    if (node.type !== "CatchClause") return;
    const body = child(node, "body");
    if (body && body.type === "BlockStatement" && children(body, "body").length === 0) {
      const hasComment = ctx.comments.some((c) => c.start >= body.start && c.end <= body.end);
      if (hasComment) return;
      ctx.report(node);
    }
  },
};
