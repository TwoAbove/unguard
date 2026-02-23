/**
 * Runtime node property access helpers.
 *
 * oxc-parser's runtime AST diverges from @oxc-project/types in some areas
 * (e.g., all literals use type "Literal" at runtime vs NullLiteral/StringLiteral in types).
 * These helpers provide typed access to common node shapes without `as any` casts.
 */
import type { Node } from "oxc-parser";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- intentional escape hatch for untyped AST access
type AnyNode = Record<string, any>;

/** Safely access a property on any AST node. */
export function prop<T = unknown>(node: Node, key: string): T {
  return (node as AnyNode)[key] as T;
}

/** Get child node. Returns Node or null. */
export function child(node: Node, key: string): Node | null {
  const val = (node as AnyNode)[key];
  if (val === undefined || val === null) return null;
  return val as Node;
}

/** Get child nodes array. Returns Node[] or empty. */
export function children(node: Node, key: string): Node[] {
  const val = (node as AnyNode)[key];
  if (!Array.isArray(val)) return [];
  return val as Node[];
}
