import fg from "fast-glob";
import { readFileSync } from "node:fs";
import type { Diagnostic, CrossFileRule } from "./rules/types.ts";
import { allRules } from "./rules/index.ts";
import { isTSRule } from "./rules/types.ts";
import { collectProject, type CommentInfo } from "./collect/index.ts";
import { createProgramFromFiles } from "./typecheck/program.ts";
import { runTSRules } from "./typecheck/walk.ts";

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

  const tsRules = activeRules.filter(isTSRule);
  const crossFileRules = activeRules.filter((r): r is CrossFileRule => !isTSRule(r));
  const diagnostics: Diagnostic[] = [];

  // Create program once — used by both TS rules and cross-file collect
  const program = files.length > 0 ? createProgramFromFiles(files) : null;

  // TS rule pass: run type-aware rules per file
  if (tsRules.length > 0 && program) {
    const checker = program.getTypeChecker();
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      const sourceFile = program.getSourceFile(file);
      if (sourceFile) {
        const tsDiags = runTSRules(tsRules, sourceFile, checker, source, file);
        diagnostics.push(...tsDiags);
      }
    }
  }

  // Cross-file pass: collect project index and run analysis rules
  if (crossFileRules.length > 0 && program) {
    const projectIndex = collectProject(program);
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

/**
 * Attach annotations from comments to diagnostics.
 * A comment annotates a diagnostic if it ends on the line immediately above.
 * Consecutive line comments are joined into a single annotation.
 */
function annotate(diagnostics: Diagnostic[], comments: CommentInfo[], source: string): void {
  if (comments.length === 0 || diagnostics.length === 0) return;

  const byEndLine = new Map<number, CommentInfo[]>();
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
    const inline = findInlineComment(d.line, byEndLine);
    if (inline !== null) {
      d.annotation = inline;
      continue;
    }
    const above = collectAnnotation(d.line - 1, byEndLine, source);
    if (above !== null) d.annotation = above;
  }
}

function findInlineComment(diagLine: number, byEndLine: Map<number, CommentInfo[]>): string | null {
  const commentsOnLine = byEndLine.get(diagLine);
  if (commentsOnLine === undefined || commentsOnLine.length === 0) return null;
  const comment = commentsOnLine.at(-1);
  if (comment === undefined) return null;
  if (comment.type !== "Line") return null;
  const text = comment.value.trim();
  if (text.startsWith("@expect")) return null;
  return text;
}

function collectAnnotation(
  commentEndLine: number,
  byEndLine: Map<number, CommentInfo[]>,
  source: string,
): string | null {
  const commentsOnLine = byEndLine.get(commentEndLine);
  if (commentsOnLine === undefined || commentsOnLine.length === 0) return null;
  const comment = commentsOnLine.at(-1);
  if (comment === undefined) return null;

  if (comment.type === "Block") {
    return cleanBlockComment(comment.value);
  }

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
