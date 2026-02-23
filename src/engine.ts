import { parseSync, type Comment } from "oxc-parser";
import { walk } from "oxc-walker";
import fg from "fast-glob";
import { readFileSync } from "node:fs";
import type { Node } from "oxc-parser";
import type { Diagnostic, SingleFileRule, CrossFileRule, Span, VisitContext } from "./rules/types.ts";
import { allRules } from "./rules/index.ts";
import { isSingleFileRule } from "./rules/types.ts";
import { collectProject } from "./collect/index.ts";

export interface ScanOptions {
  paths: string[];
  strict?: boolean;
  rules?: string[];
}

export interface ScanResult {
  diagnostics: Diagnostic[];
  fileCount: number;
}

export async function scan(options: ScanOptions): Promise<ScanResult> {
  const patterns = options.paths.length > 0 ? options.paths : ["."];
  const globs = patterns.map((p) => {
    if (p === ".") return `./**/*.{ts,cts,mts,tsx}`;
    if (p.endsWith("/")) return `${p}**/*.{ts,cts,mts,tsx}`;
    if (!p.includes("*") && !p.endsWith(".ts") && !p.endsWith(".tsx") && !p.endsWith(".cts") && !p.endsWith(".mts")) {
      return `${p}/**/*.{ts,cts,mts,tsx}`;
    }
    return p;
  });

  const files = await fg(globs, {
    ignore: ["**/node_modules/**", "**/dist/**", "**/.git/**", "**/*.d.ts", "**/*.d.cts", "**/*.d.mts"],
    absolute: true,
  });

  const activeRules = allRules.filter((r) => {
    if (options.rules && !options.rules.includes(r.id)) return false;
    return true;
  });

  const singleFileRules = activeRules.filter(isSingleFileRule);
  const crossFileRules = activeRules.filter((r): r is CrossFileRule => !isSingleFileRule(r));
  const diagnostics: Diagnostic[] = [];

  // Single-file pass: parse each file and run visitor rules
  for (const file of files) {
    const source = readFileSync(file, "utf8");
    const result = parseSync(file, source);
    const fileDiags = runSingleFileRules(singleFileRules, result.program, result.comments, source, file);
    annotate(fileDiags, result.comments, source);
    diagnostics.push(...fileDiags);
  }

  // Cross-file pass: collect project index and run analysis rules
  if (crossFileRules.length > 0 && files.length > 0) {
    const projectIndex = collectProject(files);
    for (const rule of crossFileRules) {
      const crossDiags = rule.analyze(projectIndex);
      for (const d of crossDiags) {
        const fileData = projectIndex.files.get(d.file);
        if (fileData !== undefined) annotate([d], fileData.comments, fileData.source);
      }
      diagnostics.push(...crossDiags);
    }
  }

  const seen = new Set<string>();
  const deduped: Diagnostic[] = [];
  for (const d of diagnostics) {
    const key = `${d.file}:${d.line}:${d.ruleId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(d);
  }

  if (options.strict) {
    for (const d of deduped) {
      d.severity = "error";
    }
  }

  return { diagnostics: deduped, fileCount: files.length };
}

function runSingleFileRules(
  rules: SingleFileRule[],
  program: Node,
  comments: Comment[],
  source: string,
  filename: string,
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  const makeCtx = (rule: SingleFileRule): VisitContext => ({
    filename,
    source,
    report(span: Span, message?: string) {
      const pos = lineCol(source, span.start);
      diagnostics.push({
        ruleId: rule.id,
        severity: rule.severity,
        message: message === undefined ? rule.message : message,
        file: filename,
        ...pos,
      });
    },
  });

  const contexts = rules.map((r) => ({ rule: r, ctx: makeCtx(r) }));

  walk(program, {
    enter(node: Node, parent: Node | null) {
      for (const { rule, ctx } of contexts) {
        rule.visit(node, parent, ctx);
      }
    },
  });

  for (const { rule, ctx } of contexts) {
    if (rule.visitComment) {
      for (const comment of comments) {
        rule.visitComment(comment, ctx);
      }
    }
  }

  return diagnostics;
}

interface Position {
  line: number;
  column: number;
}

/**
 * Attach annotations from comments to diagnostics.
 * A comment annotates a diagnostic if it ends on the line immediately above.
 * Consecutive line comments are joined into a single annotation.
 */
function annotate(diagnostics: Diagnostic[], comments: Comment[], source: string): void {
  if (comments.length === 0 || diagnostics.length === 0) return;

  // Build a map: endLine -> comment
  const byEndLine = new Map<number, Comment[]>();
  for (const c of comments) {
    const endLine = lineAt(source, c.end);
    let list = byEndLine.get(endLine);
    if (list === undefined) {
      list = [];
      byEndLine.set(endLine, list);
    }
    list.push(c);
  }

  for (const d of diagnostics) {
    // Check inline comment on the same line first
    const inline = findInlineComment(d.line, byEndLine);
    if (inline !== null) {
      d.annotation = inline;
      continue;
    }
    // Then check comment(s) on the line above
    const above = collectAnnotation(d.line - 1, byEndLine, source);
    if (above !== null) d.annotation = above;
  }
}

function findInlineComment(diagLine: number, byEndLine: Map<number, Comment[]>): string | null {
  const commentsOnLine = byEndLine.get(diagLine);
  if (commentsOnLine === undefined || commentsOnLine.length === 0) return null;
  const comment = commentsOnLine.at(-1);
  if (comment === undefined) return null;
  // Only line comments (// ...) count as inline annotations, not block comments
  if (comment.type !== "Line") return null;
  const text = comment.value.trim();
  // Skip @expect annotations — those are for the test harness, not user annotations
  if (text.startsWith("@expect")) return null;
  return text;
}

function collectAnnotation(
  commentEndLine: number,
  byEndLine: Map<number, Comment[]>,
  source: string,
): string | null {
  const commentsOnLine = byEndLine.get(commentEndLine);
  if (commentsOnLine === undefined || commentsOnLine.length === 0) return null;
  const comment = commentsOnLine.at(-1);
  if (comment === undefined) return null;

  // Block comment: use its value directly
  if (comment.type === "Block") {
    return cleanBlockComment(comment.value);
  }

  // Line comment: walk upward to collect consecutive line comments
  const lines: string[] = [comment.value.trim()];
  let prevLine = commentEndLine - 1;
  for (;;) {
    const prev = byEndLine.get(prevLine);
    if (prev === undefined || prev.length === 0) break;
    const prevComment = prev.at(-1);
    if (prevComment === undefined || prevComment.type !== "Line") break;
    if (lineAt(source, prevComment.start) !== prevLine) break;
    lines.unshift(prevComment.value.trim());
    prevLine--;
  }

  return lines.join("\n");
}

function cleanBlockComment(value: string): string {
  return value
    .split("\n")
    .map((line) => line.replace(/^\s*\*\s?/, "").trim())
    .filter((line) => line.length > 0)
    .join("\n");
}

function lineAt(source: string, offset: number): number {
  let line = 1;
  for (let i = 0; i < offset && i < source.length; i++) {
    if (source[i] === "\n") line++;
  }
  return line;
}

function lineCol(source: string, offset: number): Position {
  let line = 1;
  let col = 1;
  for (let i = 0; i < offset && i < source.length; i++) {
    if (source[i] === "\n") {
      line++;
      col = 1;
    } else {
      col++;
    }
  }
  return { line, column: col };
}
