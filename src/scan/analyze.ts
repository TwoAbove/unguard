import { collectProject, type CommentInfo } from "../collect/index.ts";
import { isTSRule } from "../rules/types.ts";
import type { CrossFileRule, Diagnostic, Rule } from "../rules/types.ts";
import { createProgramFromFiles } from "../typecheck/program.ts";

export function analyzeFiles(files: string[], rules: Rule[]): Diagnostic[] {
  const tsRules = rules.filter(isTSRule);
  const crossFileRules = rules.filter((r): r is CrossFileRule => !isTSRule(r));

  const program = files.length > 0 ? createProgramFromFiles(files) : null;
  if (!program) return [];

  const allowedFiles = new Set(files);
  const { index, diagnostics } = collectProject(program, tsRules, allowedFiles);

  for (const rule of crossFileRules) {
    const crossDiagnostics = rule.analyze(index);
    for (const diagnostic of crossDiagnostics) {
      const fileData = index.files.get(diagnostic.file);
      if (fileData !== undefined) annotate([diagnostic], fileData.comments, fileData.source);
    }
    diagnostics.push(...crossDiagnostics);
  }

  return dedupeDiagnostics(diagnostics);
}

function dedupeDiagnostics(diagnostics: Diagnostic[]): Diagnostic[] {
  const seen = new Set<string>();
  const deduped: Diagnostic[] = [];
  for (const diagnostic of diagnostics) {
    const key = `${diagnostic.file}:${diagnostic.line}:${diagnostic.ruleId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(diagnostic);
  }
  return deduped;
}

/**
 * Attach annotations from comments to diagnostics.
 * A comment annotates a diagnostic if it ends on the line immediately above.
 * Consecutive line comments are joined into a single annotation.
 */
function annotate(diagnostics: Diagnostic[], comments: CommentInfo[], source: string): void {
  if (comments.length === 0 || diagnostics.length === 0) return;

  const byEndLine = new Map<number, CommentInfo[]>();
  for (const comment of comments) {
    const endLine = lineAt(source, comment.end);
    let list = byEndLine.get(endLine);
    if (list === undefined) {
      list = [];
      byEndLine.set(endLine, list);
    }
    list.push(comment);
  }

  for (const diagnostic of diagnostics) {
    const inline = findInlineComment(diagnostic.line, byEndLine);
    if (inline !== null) {
      diagnostic.annotation = inline;
      continue;
    }
    const above = collectAnnotation(diagnostic.line - 1, byEndLine, source);
    if (above !== null) diagnostic.annotation = above;
  }
}

function lastCommentOnLine(line: number, byEndLine: Map<number, CommentInfo[]>): CommentInfo | null {
  const commentsOnLine = byEndLine.get(line);
  if (commentsOnLine === undefined || commentsOnLine.length === 0) return null;
  return commentsOnLine.at(-1) ?? null;
}

function findInlineComment(diagLine: number, byEndLine: Map<number, CommentInfo[]>): string | null {
  const comment = lastCommentOnLine(diagLine, byEndLine);
  if (comment === null || comment.type !== "Line") return null;
  const text = comment.value.trim();
  if (text.startsWith("@expect")) return null;
  return text;
}

function collectAnnotation(
  commentEndLine: number,
  byEndLine: Map<number, CommentInfo[]>,
  source: string,
): string | null {
  const comment = lastCommentOnLine(commentEndLine, byEndLine);
  if (comment === null) return null;

  if (comment.type === "Block") return cleanBlockComment(comment.value);

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
