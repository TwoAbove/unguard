import { createHash } from "node:crypto";
import type { Node } from "oxc-parser";
import { prop, child, children } from "./narrow.ts";

/**
 * Create a structural hash of a type node.
 * Normalizes by sorting property names and stripping locations.
 */
export function hashTypeShape(node: Node, source: string): string {
  const normalized = normalizeTypeNode(node, source);
  return createHash("sha256").update(normalized).digest("hex").slice(0, 16);
}

function normalizeTypeNode(node: Node, source: string): string {
  if (node.type === "TSTypeLiteral") {
    const members = children(node, "members");
    const normalized = members.map((m) => normalizeTypeNode(m, source)).sort().join(";");
    return `{${normalized}}`;
  }
  if (node.type === "TSInterfaceBody") {
    const members = children(node, "body");
    const normalized = members.map((m) => normalizeTypeNode(m, source)).sort().join(";");
    return `{${normalized}}`;
  }
  if (node.type === "TSPropertySignature") {
    const key = child(node, "key");
    const rawName = key ? prop<string>(key, "name") : undefined;
    const keyName = rawName !== undefined ? rawName : key ? source.slice(key.start, key.end) : "?";
    const typeAnno = child(node, "typeAnnotation");
    const innerType = typeAnno ? child(typeAnno, "typeAnnotation") : null;
    const type = innerType ? normalizeTypeNode(innerType, source) : "any";
    const optional = prop<boolean>(node, "optional") ? "?" : "";
    return `${keyName}${optional}:${type}`;
  }
  if (node.type === "TSTypeAnnotation") {
    const inner = child(node, "typeAnnotation");
    return inner ? normalizeTypeNode(inner, source) : "any";
  }
  // Fallback: use source text with whitespace normalized
  return source.slice(node.start, node.end).replace(/\s+/g, " ").trim();
}

/**
 * Hash a function body for duplicate detection.
 * Normalizes whitespace.
 */
export function hashFunctionBody(node: Node, source: string): string {
  const bodyText = source.slice(node.start, node.end);
  const normalized = bodyText.replace(/\s+/g, " ").trim();
  return createHash("sha256").update(normalized).digest("hex").slice(0, 16);
}
