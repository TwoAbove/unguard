import type { Node } from "oxc-parser";
import type { SingleFileRule, VisitContext } from "../types.ts";

export const noInlineTypeInParams: SingleFileRule = {
  id: "no-inline-type-in-params",
  severity: "warning",
  message: "Inline type literal in annotation; extract to a named type for reuse and clarity",

  visit(node: Node, parent: Node | null, ctx: VisitContext) {
    if (node.type !== "TSTypeLiteral") return;
    if (parent === null || parent.type !== "TSTypeAnnotation") return;

    if (isInsideMethodOrInterface(ctx.source, node.start)) return;

    ctx.report(node);
  },
};

function isInsideMethodOrInterface(source: string, offset: number): boolean {
  let depth = 0;
  for (let i = offset - 1; i >= 0; i--) {
    if (source[i] === "}") depth++;
    if (source[i] === "{") {
      if (depth === 0) {
        const before = source.slice(Math.max(0, i - 100), i).trimEnd();
        if (/\b(interface|class)\s+\w+/.test(before)) return true;
        return false;
      }
      depth--;
    }
  }
  return false;
}
