import type { Node } from "oxc-parser";
import type { SingleFileRule, VisitContext } from "../types.ts";
import { prop, child, children } from "../../utils/narrow.ts";

export const noErrorRewrap: SingleFileRule = {
  id: "no-error-rewrap",
  severity: "warning",
  message:
    "Re-wrapped error loses the original stack trace and type; use { cause: originalError } to preserve the error chain",

  visit(node: Node, _parent: Node | null, ctx: VisitContext) {
    if (node.type !== "CatchClause") return;
    const param = child(node, "param");
    if (param === null || param.type !== "Identifier") return;
    const catchName = prop<string>(param, "name");
    const body = child(node, "body");
    if (body === null) return;
    findRewraps(body, catchName, ctx);
  },
};

function findRewraps(root: Node, catchName: string, ctx: VisitContext): void {
  if (root.type === "ThrowStatement") {
    const arg = child(root, "argument");
    if (arg !== null && arg.type === "NewExpression") {
      const args = children(arg, "arguments");
      if (args.length > 0 && referencesName(args, catchName) && !hasCauseArg(args)) {
        ctx.report(root);
      }
    }
    return;
  }
  // Skip nested function scopes
  if (
    root.type === "FunctionDeclaration" ||
    root.type === "FunctionExpression" ||
    root.type === "ArrowFunctionExpression"
  ) {
    return;
  }
  const keys = Object.keys(root);
  for (const key of keys) {
    if (key === "start" || key === "end" || key === "type") continue;
    const val = prop<unknown>(root, key);
    if (val === null || val === undefined || typeof val !== "object") continue;
    if (Array.isArray(val)) {
      for (const item of val) {
        if (item !== null && typeof item === "object" && "type" in item) {
          findRewraps(item as Node, catchName, ctx);
        }
      }
    } else if ("type" in val) {
      findRewraps(val as Node, catchName, ctx);
    }
  }
}

function referencesName(nodes: Node[], name: string): boolean {
  for (const node of nodes) {
    if (containsIdentifier(node, name)) return true;
  }
  return false;
}

function containsIdentifier(root: Node, name: string): boolean {
  if (root.type === "Identifier" && prop<string>(root, "name") === name) return true;
  const keys = Object.keys(root);
  for (const key of keys) {
    if (key === "start" || key === "end" || key === "type") continue;
    const val = prop<unknown>(root, key);
    if (val === null || val === undefined || typeof val !== "object") continue;
    if (Array.isArray(val)) {
      for (const item of val) {
        if (item !== null && typeof item === "object" && "type" in item) {
          if (containsIdentifier(item as Node, name)) return true;
        }
      }
    } else if ("type" in val) {
      if (containsIdentifier(val as Node, name)) return true;
    }
  }
  return false;
}

function hasCauseArg(args: Node[]): boolean {
  for (const arg of args) {
    if (arg.type === "ObjectExpression") {
      const props = children(arg, "properties");
      for (const p of props) {
        const key = child(p, "key");
        if (key !== null && key.type === "Identifier" && prop<string>(key, "name") === "cause") {
          return true;
        }
      }
    }
  }
  return false;
}
