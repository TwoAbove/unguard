import { collectProject, type CommentInfo } from "../collect/index.ts";
import { isTSRule } from "../rules/types.ts";
import type { CrossFileRule, Diagnostic, Rule } from "../rules/types.ts";
import { groupFilesByTsconfig, mergeCompatibleGroups, createProgramForGroup } from "../typecheck/program.ts";

export function analyzeFiles(files: string[], rules: Rule[]): Diagnostic[] {
  const tsRules = rules.filter(isTSRule);
  const crossFileRules = rules.filter((r): r is CrossFileRule => !isTSRule(r));

  const groupConfigs = mergeCompatibleGroups(groupFilesByTsconfig(files));
  if (groupConfigs.length === 0) return [];

  const allDiagnostics: Diagnostic[] = [];
  const allFiles = new Map<string, { source: string; comments: CommentInfo[] }>();
  const allowedAll = new Set(files);

  // Process each tsconfig group sequentially so only one ts.Program is alive
  // at a time. Strip AST references when copying file data to allow GC of the
  // previous program before the next one is created.
  for (const groupConfig of groupConfigs) {
    const program = createProgramForGroup(groupConfig, { expandProjectFiles: true });
    const allowed = new Set(groupConfig.scanFiles);
    const { index, diagnostics } = collectProject(program, tsRules, allowed);
    allDiagnostics.push(...diagnostics);

    for (const rule of crossFileRules) {
      const ruleDiags = rule.analyze(index);
      allDiagnostics.push(...ruleDiags.filter((d) => allowedAll.has(d.file)));
    }

    for (const [k, v] of index.files) {
      allFiles.set(k, { source: v.source, comments: v.comments });
    }
  }

  return finalizeDiagnostics(allDiagnostics, allFiles);
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

function finalizeDiagnostics(
  diagnostics: Diagnostic[],
  files: Map<string, { source: string; comments: CommentInfo[] }>,
): Diagnostic[] {
  const diagnosticsByFile = new Map<string, Diagnostic[]>();
  for (const diagnostic of diagnostics) {
    let list = diagnosticsByFile.get(diagnostic.file);
    if (list === undefined) {
      list = [];
      diagnosticsByFile.set(diagnostic.file, list);
    }
    list.push(diagnostic);
  }

  const finalized: Diagnostic[] = [];
  for (const [file, fileDiagnostics] of diagnosticsByFile) {
    const fileData = files.get(file);
    if (fileData === undefined) {
      finalized.push(...fileDiagnostics);
      continue;
    }
    finalized.push(...annotateAndFilter(fileDiagnostics, fileData.comments, fileData.source));
  }

  return dedupeDiagnostics(finalized);
}

/**
 * Attach annotations from comments to diagnostics.
 * A comment annotates a diagnostic if it ends on the line immediately above.
 * Consecutive line comments are joined into a single annotation.
 */
function annotateAndFilter(diagnostics: Diagnostic[], comments: CommentInfo[], source: string): Diagnostic[] {
  if (diagnostics.length === 0) return diagnostics;
  if (comments.length === 0) return diagnostics;

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

  const kept: Diagnostic[] = [];
  for (const diagnostic of diagnostics) {
    if (isSatisfiedByComment(diagnostic, byEndLine, source)) continue;

    const inline = findInlineComment(diagnostic.line, byEndLine);
    if (inline !== null) {
      diagnostic.annotation = inline;
      kept.push(diagnostic);
      continue;
    }
    const above = collectAnnotation(diagnostic.line - 1, byEndLine, source);
    if (above !== null) diagnostic.annotation = above;
    kept.push(diagnostic);
  }

  return kept;
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
  if (isDirectiveComment(text)) return null;
  return text;
}

function collectAnnotation(
  commentEndLine: number,
  byEndLine: Map<number, CommentInfo[]>,
  source: string,
): string | null {
  const comments = collectCommentsAbove(commentEndLine, byEndLine, source);
  if (comments.length === 0) return null;
  const first = comments[0];
  if (comments.length === 1 && first !== undefined && first.type === "Block") {
    return cleanBlockComment(first.value);
  }
  return comments.map((c) => c.value.trim()).join("\n");
}

function isSatisfiedByComment(
  diagnostic: Diagnostic,
  byEndLine: Map<number, CommentInfo[]>,
  source: string,
): boolean {
  if (diagnostic.severity === "error") return false;

  const candidates = getCommentCandidates(diagnostic.line, byEndLine, source);
  return candidates.some((comment) => commentSatisfiesRule(comment, diagnostic.ruleId));
}

function getCommentCandidates(
  diagLine: number,
  byEndLine: Map<number, CommentInfo[]>,
  source: string,
): CommentInfo[] {
  const inline = byEndLine.get(diagLine) ?? [];
  const above = collectCommentsAbove(diagLine - 1, byEndLine, source);
  // Also check the line immediately below (inside a block body).
  // Formatters like Biome/Prettier enforce `} catch {` on one line,
  // forcing suppression comments into the block where they end up on diagLine + 1.
  const below = byEndLine.get(diagLine + 1) ?? [];
  return [...inline, ...above, ...below];
}

function collectCommentsAbove(
  commentEndLine: number,
  byEndLine: Map<number, CommentInfo[]>,
  source: string,
): CommentInfo[] {
  const comment = lastCommentOnLine(commentEndLine, byEndLine);
  if (comment === null) return [];
  if (comment.type === "Block") return [comment];

  const lines: CommentInfo[] = [comment];
  let prevLine = commentEndLine - 1;
  for (;;) {
    const prev = byEndLine.get(prevLine);
    if (prev === undefined || prev.length === 0) break;
    const prevComment = prev.at(-1);
    if (prevComment === undefined || prevComment.type !== "Line") break;
    if (lineAt(source, prevComment.start) !== prevLine) break;
    lines.unshift(prevComment);
    prevLine--;
  }

  return lines;
}

function commentSatisfiesRule(comment: CommentInfo, ruleId: string): boolean {
  for (const line of commentLines(comment)) {
    const match = line.match(/^@unguard\s+([^\s]+)\b/);
    if (match?.[1] === ruleId) return true;
  }
  return false;
}

function commentLines(comment: CommentInfo): string[] {
  if (comment.type === "Block") {
    const cleaned = cleanBlockComment(comment.value);
    if (cleaned.length === 0) return [];
    return cleaned.split("\n");
  }
  return [comment.value.trim()];
}

function isDirectiveComment(text: string): boolean {
  return text.startsWith("@expect") || text.startsWith("@unguard");
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
