import type { Node } from "oxc-parser";
import type { SingleFileRule, VisitContext } from "../types.ts";
import { child, isFunctionLike, prop } from "../../utils/narrow.ts";

export const noCatchReturn: SingleFileRule = {
  id: "no-catch-return",
  severity: "warning",
  message:
    "Catch block silently returns a fallback value with no logging; rethrow, log the error, or let it propagate",

  visit(node: Node, _parent: Node | null, ctx: VisitContext) {
    if (node.type !== "CatchClause") return;
    const body = child(node, "body");
    if (body === null) return;
    if (hasReturn(body) && !hasThrow(body) && !hasLogging(body)) {
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

const LOG_OBJECTS = new Set(["console", "logger", "log"]);

function hasLogging(root: Node): boolean {
  if (root.type === "CallExpression") {
    const callee = child(root, "callee");
    if (callee && callee.type === "MemberExpression") {
      const obj = child(callee, "object");
      if (obj && obj.type === "Identifier") {
        const name = prop<string>(obj, "name");
        if (name !== undefined && LOG_OBJECTS.has(name)) return true;
      }
    }
  }
  const keys = Object.keys(root);
  for (const key of keys) {
    if (key === "start" || key === "end" || key === "type") continue;
    const val = prop<unknown>(root, key);
    if (val === null || val === undefined || typeof val !== "object") continue;
    if (isFunctionLike(val as Node)) continue;
    if (Array.isArray(val)) {
      for (const item of val) {
        if (item !== null && typeof item === "object" && "type" in item) {
          if (isFunctionLike(item as Node)) continue;
          if (hasLogging(item as Node)) return true;
        }
      }
    } else if ("type" in val) {
      if (hasLogging(val as Node)) return true;
    }
  }
  return false;
}

function walkForType(root: Node, targetType: string): boolean {
  if (root.type === targetType) return true;
  const keys = Object.keys(root);
  for (const key of keys) {
    if (key === "start" || key === "end" || key === "type") continue;
    const val = prop<unknown>(root, key);
    if (val === null || val === undefined || typeof val !== "object") continue;
    // Skip nested function scopes — their returns/throws are their own
    if (isFunctionLike(val as Node)) continue;
    if (Array.isArray(val)) {
      for (const item of val) {
        if (item !== null && typeof item === "object" && "type" in item) {
          if (isFunctionLike(item as Node)) continue;
          if (walkForType(item as Node, targetType)) return true;
        }
      }
    } else if ("type" in val) {
      if (walkForType(val as Node, targetType)) return true;
    }
  }
  return false;
}

