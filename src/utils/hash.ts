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
  const normalized = stripComments(node.getText(sourceFile));
  return createHash("sha256").update(normalized).digest("hex").slice(0, 16);
}

/**
 * Whitespace-normalized body text length.
 * Used to filter trivially small function bodies from duplicate detection.
 */
export function bodyTextLength(node: ts.Node, sourceFile: ts.SourceFile): number {
  return stripComments(node.getText(sourceFile)).length;
}

function stripComments(text: string): string {
  return text.replace(/\/\/[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\s+/g, " ").trim();
}

function normalizeBody(node: ts.Node, sourceFile: ts.SourceFile, paramNames: string[]): string {
  let text = node.getText(sourceFile);
  // Strip line comments
  text = text.replace(/\/\/[^\n]*/g, "");
  // Strip block comments
  text = text.replace(/\/\*[\s\S]*?\*\//g, "");
  // Normalize string literals (double-quoted, single-quoted, template)
  text = text.replace(/"(?:[^"\\]|\\.)*"/g, '"__STR__"');
  text = text.replace(/'(?:[^'\\]|\\.)*'/g, '"__STR__"');
  text = text.replace(/`(?:[^`\\]|\\.)*`/g, '"__STR__"');
  // Normalize numeric literals (standalone numbers, not inside identifiers)
  text = text.replace(/\b\d+(?:\.\d+)?\b/g, "__NUM__");
  // Normalize parameter names to positional placeholders
  for (let i = 0; i < paramNames.length; i++) {
    const name = paramNames[i] as string;
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    text = text.replace(new RegExp(`\\b${escaped}\\b`, "g"), `$${i}`);
  }
  // Normalize member-access objects: this.x and $N.x both become $_.x
  text = text.replace(/\bthis\./g, "$_.");
  text = text.replace(/\$\d+\./g, "$_.");
  // Normalize whitespace
  text = text.replace(/\s+/g, " ").trim();
  return text;
}

/**
 * Normalize raw text (not from an AST node) using the same normalization pipeline.
 * Used for statement-sequence hashing.
 */
export function normalizeText(text: string): string {
  // Strip line comments
  let t = text.replace(/\/\/[^\n]*/g, "");
  // Strip block comments
  t = t.replace(/\/\*[\s\S]*?\*\//g, "");
  // Normalize string literals
  t = t.replace(/"(?:[^"\\]|\\.)*"/g, '"__STR__"');
  t = t.replace(/'(?:[^'\\]|\\.)*'/g, '"__STR__"');
  t = t.replace(/`(?:[^`\\]|\\.)*`/g, '"__STR__"');
  // Normalize numeric literals
  t = t.replace(/\b\d+(?:\.\d+)?\b/g, "__NUM__");
  // Normalize member-access objects
  t = t.replace(/\bthis\./g, "$_.");
  // Normalize whitespace
  t = t.replace(/\s+/g, " ").trim();
  return t;
}

export function hashText(text: string): string {
  return createHash("sha256").update(text).digest("hex").slice(0, 16);
}

export function hashFunctionBodyNormalized(
  node: ts.Node,
  sourceFile: ts.SourceFile,
  paramNames: string[],
): string {
  const text = normalizeBody(node, sourceFile, paramNames);
  return createHash("sha256").update(text).digest("hex").slice(0, 16);
}

/**
 * Length of fully-normalized body text (strings/numbers/params replaced).
 * Used to filter near-duplicate groups with trivial collapsed bodies.
 */
export function normalizedBodyTextLength(
  node: ts.Node,
  sourceFile: ts.SourceFile,
  paramNames: string[],
): number {
  return normalizeBody(node, sourceFile, paramNames).length;
}
