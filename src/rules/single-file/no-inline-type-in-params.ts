import type { Node } from "oxc-parser";
import type { SingleFileRule, VisitContext } from "../types.ts";

export const noInlineTypeInParams: SingleFileRule = {
  id: "no-inline-type-in-params",
  severity: "info",
  message: "Inline type literal in annotation; extract to a named type for reuse and clarity",

  visit(node: Node, parent: Node | null, ctx: VisitContext) {
    if (node.type !== "TSTypeLiteral") return;
    if (parent === null || parent.type !== "TSTypeAnnotation") return;

    if (!isTopLevelFunctionParam(ctx.source, node.start)) return;

    ctx.report(node);
  },
};

function isTopLevelFunctionParam(source: string, offset: number): boolean {
  // Only flag if the nearest enclosing "{" is the module scope (no enclosing brace)
  // or a plain function body. Skip anything nested inside classes, interfaces,
  // object literals (builder patterns), etc.
  let depth = 0;
  for (let i = offset - 1; i >= 0; i--) {
    if (source[i] === "}") depth++;
    if (source[i] === "{") {
      if (depth === 0) {
        // Found the enclosing "{". If it belongs to a function declaration
        // or arrow, that's fine (we're in a nested function param). But if
        // it's anything else (class, interface, object literal), skip.
        // In practice: only flag when there's NO enclosing "{" at all
        // (module-level function), or the enclosing block is a function body.
        const before = source.slice(Math.max(0, i - 150), i).trimEnd();
        // Function body: preceded by ")" or "=> {" or similar
        if (/(\)|\bfunction\b.*\))\s*$/.test(before)) {
          // Inside a function body — keep walking to check if that function
          // is itself top-level or nested
          depth--;
          continue;
        }
        // Anything else (class, interface, object, etc.) — not top-level
        return false;
      }
      depth--;
    }
  }
  // Reached beginning of file with no unmatched "{" — module scope
  return true;
}
