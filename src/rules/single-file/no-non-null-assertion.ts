import type { Node } from "oxc-parser";
import type { SingleFileRule, VisitContext } from "../types.ts";
import { child, children, isFunctionLike, prop } from "../../utils/narrow.ts";

export const noNonNullAssertion: SingleFileRule = {
  id: "no-non-null-assertion",
  severity: "warning",
  message: "Non-null assertion (!) overrides the type checker; narrow with a type guard or fix the type so it's not nullable",

  visit(node: Node, _parent: Node | null, ctx: VisitContext) {
    // Visit function-level nodes and Program to analyze their bodies
    if (!isFunctionLike(node) && node.type !== "Program") return;

    const body = node.type === "Program" ? node : child(node, "body");
    if (body === null) return;

    // Collect identifiers that are guarded by conditionals in this scope
    const guardedNames = new Set<string>();
    collectGuardedNames(body, guardedNames);

    // Find and report unguarded ! assertions
    reportUnguardedAssertions(body, guardedNames, ctx);
  },
};

/** Walk subtree collecting identifiers that appear in narrowing positions. */
function collectGuardedNames(root: Node, names: Set<string>): void {
  // if (x) / if (!x) / if (x !== null) / if (x != null)
  if (root.type === "IfStatement") {
    const test = child(root, "test");
    if (test) collectIdentifiersFromExpr(test, names);
  }

  // x && ... — left side is narrowed
  if (root.type === "LogicalExpression" && prop<string>(root, "operator") === "&&") {
    const left = child(root, "left");
    if (left) collectIdentifiersFromExpr(left, names);
  }

  // x ? ... : ... — test is narrowed
  if (root.type === "ConditionalExpression") {
    const test = child(root, "test");
    if (test) collectIdentifiersFromExpr(test, names);
  }

  // const x = arr.filter(...) — result variable is a narrowed version of the array
  if (root.type === "VariableDeclarator") {
    const init = child(root, "init");
    if (init && init.type === "CallExpression") {
      const callee = child(init, "callee");
      if (callee && callee.type === "MemberExpression") {
        const property = child(callee, "property");
        if (property && prop<string>(property, "name") === "filter") {
          const id = child(root, "id");
          if (id) collectIdentifiersFromExpr(id, names);
        }
      }
    }
  }

  // Recurse, but skip nested function scopes
  walkChildren(root, (child) => {
    if (isFunctionLike(child)) return;
    collectGuardedNames(child, names);
  });
}

/** Extract all identifier names from an expression (for guard detection). */
function collectIdentifiersFromExpr(node: Node, names: Set<string>): void {
  if (node.type === "Identifier") {
    const name = prop<string>(node, "name");
    if (name !== undefined) names.add(name);
    return;
  }
  // Unwrap unary: !x, typeof x
  if (node.type === "UnaryExpression") {
    const arg = child(node, "argument");
    if (arg) collectIdentifiersFromExpr(arg, names);
    return;
  }
  // Binary: x !== null, x != undefined, x === something
  if (node.type === "BinaryExpression") {
    const left = child(node, "left");
    const right = child(node, "right");
    if (left) collectIdentifiersFromExpr(left, names);
    if (right) collectIdentifiersFromExpr(right, names);
    return;
  }
  // Member expressions: x.prop — collect root identifier
  if (node.type === "MemberExpression") {
    const obj = child(node, "object");
    if (obj) collectIdentifiersFromExpr(obj, names);
    return;
  }
  // Logical expressions: x && y, x || y
  if (node.type === "LogicalExpression") {
    const left = child(node, "left");
    const right = child(node, "right");
    if (left) collectIdentifiersFromExpr(left, names);
    if (right) collectIdentifiersFromExpr(right, names);
  }
}

/** Find TSNonNullExpression nodes and report unguarded ones. */
function reportUnguardedAssertions(root: Node, guardedNames: Set<string>, ctx: VisitContext): void {
  if (root.type === "TSNonNullExpression") {
    const inner = child(root, "expression");
    if (inner && isSplitElementAccess(inner)) return;

    const rootName = getRootIdentifier(inner);
    if (rootName !== null && guardedNames.has(rootName)) return;

    ctx.report(root);
    return;
  }

  // Recurse, skip nested function scopes (they have their own analysis)
  walkChildren(root, (child) => {
    if (isFunctionLike(child)) return;
    reportUnguardedAssertions(child, guardedNames, ctx);
  });
}

/** Check if expression is .split(...)[n] — always safe. */
function isSplitElementAccess(node: Node): boolean {
  if (node.type !== "MemberExpression" || prop<boolean>(node, "computed") !== true) return false;
  const obj = child(node, "object");
  if (obj === null || obj.type !== "CallExpression") return false;
  const callee = child(obj, "callee");
  if (callee === null || callee.type !== "MemberExpression") return false;
  const property = child(callee, "property");
  return property !== null && prop<string>(property, "name") === "split";
}

/** Extract the root identifier from a chain like foo.bar.baz → foo, arr[0] → arr. */
function getRootIdentifier(node: Node | null): string | null {
  if (node === null) return null;
  if (node.type === "Identifier") return prop<string>(node, "name");
  if (node.type === "MemberExpression") return getRootIdentifier(child(node, "object"));
  if (node.type === "CallExpression") return getRootIdentifier(child(node, "callee"));
  return null;
}

/** Walk all child nodes of a root, calling fn for each Node child. */
function walkChildren(root: Node, fn: (child: Node) => void): void {
  const keys = Object.keys(root);
  for (const key of keys) {
    if (key === "start" || key === "end" || key === "type") continue;
    const val = prop<unknown>(root, key);
    if (val === null || val === undefined || typeof val !== "object") continue;
    if (Array.isArray(val)) {
      for (const item of val) {
        if (item !== null && typeof item === "object" && "type" in item) {
          fn(item as Node);
        }
      }
    } else if ("type" in val) {
      fn(val as Node);
    }
  }
}
