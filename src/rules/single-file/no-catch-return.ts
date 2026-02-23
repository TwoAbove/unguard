import type { Node } from "oxc-parser";
import type { SingleFileRule, VisitContext } from "../types.ts";
import { child, prop } from "../../utils/narrow.ts";

export const noCatchReturn: SingleFileRule = {
  id: "no-catch-return",
  severity: "warning",
  message:
    "Catch block returns a value instead of throwing; this converts errors into fallback data that callers must defensively handle",

  visit(node: Node, _parent: Node | null, ctx: VisitContext) {
    if (node.type !== "CatchClause") return;
    const body = child(node, "body");
    if (body === null) return;
    if (hasReturn(body) && !hasThrow(body)) {
      ctx.report(node);
    }
  },
};

function hasReturn(block: Node): boolean {
  return walkForType(block, "ReturnStatement");
}

function hasThrow(block: Node): boolean {
  return walkForType(block, "ThrowStatement");
}

function walkForType(root: Node, targetType: string): boolean {
  if (root.type === targetType) return true;
  const keys = Object.keys(root);
  for (const key of keys) {
    if (key === "start" || key === "end" || key === "type") continue;
    const val = prop<unknown>(root, key);
    if (val === null || val === undefined || typeof val !== "object") continue;
    // Skip nested function scopes — their returns/throws are their own
    if (isFunction(val as Node)) continue;
    if (Array.isArray(val)) {
      for (const item of val) {
        if (item !== null && typeof item === "object" && "type" in item) {
          if (isFunction(item as Node)) continue;
          if (walkForType(item as Node, targetType)) return true;
        }
      }
    } else if ("type" in val) {
      if (walkForType(val as Node, targetType)) return true;
    }
  }
  return false;
}

function isFunction(node: Node): boolean {
  return (
    node.type === "FunctionDeclaration" ||
    node.type === "FunctionExpression" ||
    node.type === "ArrowFunctionExpression"
  );
}
