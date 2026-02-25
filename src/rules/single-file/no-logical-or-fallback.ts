import type { Node } from "oxc-parser";
import type { SingleFileRule, VisitContext } from "../types.ts";
import { prop, child } from "../../utils/narrow.ts";
import { isLiteral } from "../../utils/ast.ts";

export const noLogicalOrFallback: SingleFileRule = {
  id: "no-logical-or-fallback",
  severity: "warning",
  message:
    '|| fallback on a data-structure lookup swallows valid falsy values (0, ""); use ?? to only catch null/undefined',

  visit(node: Node, parent: Node | null, ctx: VisitContext) {
    if (node.type !== "LogicalExpression") return;
    if (prop<string>(node, "operator") !== "||") return;
    const right = child(node, "right");
    if (!right || !isLiteral(right)) return;
    const left = child(node, "left");
    if (!left) return;
    if (isDataStructureLookup(left, parent)) {
      ctx.report(node);
    }
  },
};

function isDataStructureLookup(left: Node, parent: Node | null): boolean {
  // Skip: entire || is an argument to parseInt(...)
  if (parent && parent.type === "CallExpression") {
    const callee = child(parent, "callee");
    if (callee && callee.type === "Identifier" && prop<string>(callee, "name") === "parseInt") {
      return false;
    }
  }

  // Skip: LHS is Number(...) — || catches NaN/0 intentionally
  if (left.type === "CallExpression") {
    const callee = child(left, "callee");
    if (callee && callee.type === "Identifier" && prop<string>(callee, "name") === "Number") {
      return false;
    }
    // Skip: LHS is *.trim()
    if (callee && callee.type === "MemberExpression") {
      const property = child(callee, "property");
      if (property && prop<string>(property, "name") === "trim") return false;
    }
  }

  // Skip: LHS is env var access (process.env.*, import.meta.env.*, Bun.env.*)
  if (isEnvAccess(left)) return false;

  // Skip: LHS accesses URL properties (.password, .port, .username)
  if (isUrlPropertyAccess(left)) return false;

  // Flag: LHS is .get(), .find(), .getStore() call
  if (left.type === "CallExpression") {
    const callee = child(left, "callee");
    if (callee && callee.type === "MemberExpression" && prop<boolean>(callee, "computed") !== true) {
      const property = child(callee, "property");
      const methodName = property ? prop<string>(property, "name") : undefined;
      if (methodName === "find" || methodName === "getStore") return true;
      if (methodName === "get") {
        // Exclude: *.headers.get()
        const obj = child(callee, "object");
        if (obj && obj.type === "MemberExpression") {
          const objProp = child(obj, "property");
          if (objProp && prop<string>(objProp, "name") === "headers") return false;
        }
        return true;
      }
    }
  }

  // Flag: LHS is computed member expression x[key]
  if (left.type === "MemberExpression" && prop<boolean>(left, "computed") === true) {
    return true;
  }

  // Flag: LHS contains optional chaining (?.)
  if (hasOptionalChaining(left)) return true;

  return false;
}

function isEnvAccess(node: Node): boolean {
  // process.env.X, Bun.env.X
  if (node.type === "MemberExpression") {
    const obj = child(node, "object");
    if (obj && obj.type === "MemberExpression") {
      const innerObj = child(obj, "object");
      const innerProp = child(obj, "property");
      if (innerObj && innerProp && prop<string>(innerProp, "name") === "env") {
        const name = innerObj.type === "Identifier" ? prop<string>(innerObj, "name") : undefined;
        if (name === "process" || name === "Bun") return true;
      }
      // import.meta.env.X
      if (innerObj && innerObj.type === "MetaProperty") {
        if (innerProp && prop<string>(innerProp, "name") === "env") return true;
      }
    }
  }
  return false;
}

function isUrlPropertyAccess(node: Node): boolean {
  if (node.type !== "MemberExpression") return false;
  const property = child(node, "property");
  if (!property) return false;
  const name = prop<string>(property, "name");
  return name === "password" || name === "port" || name === "username";
}

function hasOptionalChaining(node: Node): boolean {
  if (prop<boolean>(node, "optional") === true) return true;
  // Unwrap ChainExpression wrapper
  if (node.type === "ChainExpression") {
    const expr = child(node, "expression");
    if (expr) return hasOptionalChaining(expr);
  }
  // Walk into sub-expressions of the chain
  if (node.type === "MemberExpression" || node.type === "CallExpression") {
    const obj = child(node, node.type === "MemberExpression" ? "object" : "callee");
    if (obj) return hasOptionalChaining(obj);
  }
  return false;
}
