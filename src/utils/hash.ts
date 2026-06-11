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
 * Function-body hashes and lengths used by duplicate and near-duplicate rules.
 */
export interface FunctionBodyAnalysis {
  hash: string;
  normalizedHash: string;
  bodyLength: number;
  normalizedBodyLength: number;
}

function normalizeBodyText(text: string, paramNames: string[]): string {
  let normalized = text;
  // Normalize string literals (double-quoted, single-quoted, template)
  normalized = normalized.replace(/"(?:[^"\\]|\\.)*"/g, '"__STR__"');
  normalized = normalized.replace(/'(?:[^'\\]|\\.)*'/g, '"__STR__"');
  normalized = normalized.replace(/`(?:[^`\\]|\\.)*`/g, '"__STR__"');
  // Normalize numeric literals (standalone numbers, not inside identifiers)
  normalized = normalized.replace(/\b\d+(?:\.\d+)?\b/g, "__NUM__");
  // Normalize parameter names to positional placeholders
  for (let i = 0; i < paramNames.length; i++) {
    const name = paramNames[i] as string;
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    normalized = normalized.replace(new RegExp(`\\b${escaped}\\b`, "g"), `$${i}`);
  }
  // Normalize member-access objects: this.x and $N.x both become $_.x
  normalized = normalized.replace(/\bthis\s*\.\s*/g, "$_.");
  normalized = normalized.replace(/\$\d+\s*\.\s*/g, "$_.");
  // Normalize whitespace
  normalized = normalized.replace(/\s+/g, " ").trim();
  return normalized;
}

export function analyzeFunctionBody(
  node: ts.Node,
  sourceFile: ts.SourceFile,
  paramNames: string[],
): FunctionBodyAnalysis {
  const stripped = stripCommentsAndWhitespace(node.getText(sourceFile));
  const normalized = normalizeBodyText(stripped, paramNames);
  return {
    hash: hashText(stripped),
    normalizedHash: hashText(normalized),
    bodyLength: stripped.length,
    normalizedBodyLength: normalized.length,
  };
}

/**
 * Strip comments and normalize token spacing without touching literal contents.
 * Used as the textual canonical form for hashing so strings like `"http://x"`
 * remain intact while comment/trivia layout does not affect identity.
 */
export function stripCommentsAndWhitespace(text: string): string {
  const scanner = ts.createScanner(
    ts.ScriptTarget.Latest,
    true,
    ts.LanguageVariant.Standard,
    text,
  );
  const tokens: string[] = [];
  let token = scanner.scan();
  while (token !== ts.SyntaxKind.EndOfFileToken) {
    tokens.push(scanner.getTokenText());
    token = scanner.scan();
  }
  return tokens.join(" ").trim();
}

/**
 * Normalize raw text (not from an AST node) using the same normalization pipeline.
 * Used for statement-sequence hashing.
 */
export function normalizeText(text: string): string {
  let t = stripCommentsAndWhitespace(text);
  // Normalize string literals
  t = t.replace(/"(?:[^"\\]|\\.)*"/g, '"__STR__"');
  t = t.replace(/'(?:[^'\\]|\\.)*'/g, '"__STR__"');
  t = t.replace(/`(?:[^`\\]|\\.)*`/g, '"__STR__"');
  // Normalize numeric literals
  t = t.replace(/\b\d+(?:\.\d+)?\b/g, "__NUM__");
  // Normalize member-access objects
  t = t.replace(/\bthis\./g, "$_.");
  return t;
}

export function hashText(text: string): string {
  return createHash("sha256").update(text).digest("hex").slice(0, 16);
}
