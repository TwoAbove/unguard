import { createHash } from "node:crypto";
import * as ts from "typescript";

/**
 * Create a structural hash of a type node.
 * Normalizes by sorting property names and stripping locations.
 */
export function hashTypeShape(node: ts.Node, sourceFile: ts.SourceFile): string {
  const normalized = normalizeTypeNode(node, sourceFile);
  return createHash("sha256").update(normalized).digest("hex").slice(0, 16);
}

function normalizeTypeNode(node: ts.Node, sourceFile: ts.SourceFile): string {
  if (ts.isTypeLiteralNode(node)) {
    const normalized = node.members.map((m) => normalizeTypeNode(m, sourceFile)).sort().join(";");
    return `{${normalized}}`;
  }
  if (ts.isInterfaceDeclaration(node)) {
    const normalized = node.members.map((m) => normalizeTypeNode(m, sourceFile)).sort().join(";");
    return `{${normalized}}`;
  }
  if (ts.isPropertySignature(node)) {
    const keyName = node.name.getText(sourceFile);
    const optional = node.questionToken ? "?" : "";
    const type = node.type ? normalizeTypeNode(node.type, sourceFile) : "any";
    return `${keyName}${optional}:${type}`;
  }
  if (ts.isTypeAliasDeclaration(node)) {
    return normalizeTypeNode(node.type, sourceFile);
  }
  // Fallback: use source text with whitespace normalized
  return node.getText(sourceFile).replace(/\s+/g, " ").trim();
}

/**
 * Hash a function body for duplicate detection.
 * Normalizes whitespace.
 */
export function hashFunctionBody(node: ts.Node, sourceFile: ts.SourceFile): string {
  const bodyText = node.getText(sourceFile);
  const normalized = bodyText.replace(/\s+/g, " ").trim();
  return createHash("sha256").update(normalized).digest("hex").slice(0, 16);
}
