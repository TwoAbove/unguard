import * as ts from "typescript";
import type { TSRule, TSVisitContext } from "../types.ts";

function isTopLevelFunctionParam(source: string, offset: number): boolean {
  let depth = 0;
  for (let i = offset - 1; i >= 0; i--) {
    if (source[i] === "}") depth++;
    if (source[i] === "{") {
      if (depth === 0) {
        const before = source.slice(Math.max(0, i - 150), i).trimEnd();
        if (/(\)|\bfunction\b.*\))\s*$/.test(before)) {
          depth--;
          continue;
        }
        return false;
      }
      depth--;
    }
  }
  return true;
}

export const noInlineTypeInParams: TSRule = {
  kind: "ts",
  id: "no-inline-type-in-params",
  severity: "info",
  message: "Inline type literal in annotation; extract to a named type for reuse and clarity",

  visit(node: ts.Node, ctx: TSVisitContext) {
    if (!ts.isTypeLiteralNode(node)) return;
    // Parent should be a type annotation on a parameter
    const parent = node.parent;
    if (!parent || !ts.isParameter(parent)) return;
    if (parent.type !== node) return;

    const offset = node.getStart(ctx.sourceFile);
    if (!isTopLevelFunctionParam(ctx.source, offset)) return;
    ctx.report(node);
  },
};
