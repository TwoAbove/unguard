import { readFileSync } from "node:fs";
import type { SourceFile } from "typescript";
import { collectAllComments, collectProject, collectSourceText, createProjectIndex, type CommentInfo, type ProjectIndexNeeds } from "../collect/index.ts";
import { isTSRule } from "../rules/types.ts";
import type { CrossFileRule, Diagnostic, ProjectIndexNeed, Rule, TSRule } from "../rules/types.ts";
import { groupFilesByTsconfig, mergeCompatibleGroups, createProgramForGroup, createProgramBuildCache, expandProjectFiles } from "../typecheck/program.ts";

export function analyzeFiles(files: string[], rules: Rule[]): Diagnostic[] {
  const tsRules = rules.filter(isTSRule);
  const crossFileRules = rules.filter((r): r is CrossFileRule => !isTSRule(r));
  const indexNeeds = collectIndexNeeds(crossFileRules);

  if (!requiresProgram(tsRules, indexNeeds)) {
    return analyzeSourceOnlyFiles(files, tsRules, crossFileRules, indexNeeds);
  }

  const groupConfigs = mergeCompatibleGroups(groupFilesByTsconfig(files));
  if (groupConfigs.length === 0) return [];

  const allDiagnostics: Diagnostic[] = [];
  const allFiles = new Map<string, FileDiagnosticData>();
  const programCache = createProgramBuildCache();

  // Process each tsconfig group sequentially so only one ts.Program is alive
  // at a time. The program may load thousands of dependency files for type
  // context, but analysis only needs to traverse the files requested by the
  // scan.
  for (const groupConfig of groupConfigs) {
    const projectIndex = createProjectIndex();
    const program = createProgramForGroup(groupConfig, { expandProjectFiles: true, cache: programCache });
    const allowed = new Set(groupConfig.scanFiles);
    const collectFiles = indexNeeds.size > 0
      ? new Set(expandProjectFiles(groupConfig).filter(isAnalyzableSourcePath))
      : new Set<string>();
    const { diagnostics } = collectProject(program, tsRules, allowed, {
      collectFiles,
      needs: indexNeeds,
      index: projectIndex,
    });
    allDiagnostics.push(...diagnostics);
    allDiagnostics.push(...runCrossFileRules(crossFileRules, projectIndex, allowed));
    addFileData(allFiles, projectIndex, allowed);
  }

  return finalizeDiagnostics(allDiagnostics, allFiles);
}

function analyzeSourceOnlyFiles(
  files: string[],
  tsRules: TSRule[],
  crossFileRules: CrossFileRule[],
  indexNeeds: ProjectIndexNeeds,
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const allFiles = new Map<string, FileDiagnosticData>();

  const groupConfigs = mergeCompatibleGroups(groupFilesByTsconfig(files));
  for (const groupConfig of groupConfigs) {
    const projectIndex = createProjectIndex();
    const allowed = new Set(groupConfig.scanFiles.filter(isAnalyzableSourcePath));
    const collectFiles = (indexNeeds.size > 0 ? expandProjectFiles(groupConfig) : groupConfig.scanFiles)
      .filter(isAnalyzableSourcePath);

    for (const file of collectFiles) {
      const source = readFileSync(file, "utf8");
      const result = collectSourceText(file, source, allowed.has(file) ? tsRules : [], {
        index: projectIndex,
        needs: indexNeeds,
        retainFile: allowed.has(file) || indexNeeds.has("files"),
      });
      diagnostics.push(...result.diagnostics);
    }

    diagnostics.push(...runCrossFileRules(crossFileRules, projectIndex, allowed));
    addFileData(allFiles, projectIndex, allowed);
  }

  return finalizeDiagnostics(diagnostics, allFiles);
}

function runCrossFileRules(
  rules: CrossFileRule[],
  projectIndex: ReturnType<typeof createProjectIndex>,
  allowed: Set<string>,
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const crossFileContext = { reportableFiles: allowed };
  for (const rule of rules) {
    const ruleDiags = rule.analyze(projectIndex, crossFileContext);
    diagnostics.push(...ruleDiags.filter((d) => allowed.has(d.file)));
  }
  return diagnostics;
}

function addFileData(
  files: Map<string, FileDiagnosticData>,
  projectIndex: ReturnType<typeof createProjectIndex>,
  allowed: Set<string>,
): void {
  for (const [k, v] of projectIndex.files) {
    if (!allowed.has(k)) continue;
    files.set(k, { source: v.source, sourceFile: v.sourceFile });
  }
}

function isAnalyzableSourcePath(file: string): boolean {
  const normalized = file.replaceAll("\\", "/");
  if (normalized.includes("/node_modules/")) return false;
  return !/\.d\.[cm]?ts$/i.test(normalized);
}

function requiresProgram(tsRules: TSRule[], indexNeeds: ProjectIndexNeeds): boolean {
  if (tsRules.some((rule) => rule.requiresTypeInfo !== false)) return true;
  return indexNeeds.has("functionSymbols")
    || indexNeeds.has("callSiteSymbols")
    || indexNeeds.has("overloadCallSignatures");
}

function collectIndexNeeds(rules: CrossFileRule[]): ProjectIndexNeeds {
  const needs = new Set<ProjectIndexNeed>();
  for (const rule of rules) {
    for (const need of rule.requires ?? []) {
      needs.add(need);
    }
  }
  if (needs.has("functionSymbols")) needs.add("functions");
  if (needs.has("callSiteSymbols") || needs.has("overloadCallSignatures")) needs.add("callSites");
  if (needs.has("overloadCallSignatures")) needs.add("callSiteSymbols");
  return needs;
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
  files: Map<string, FileDiagnosticData>,
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
    finalized.push(...annotateAndFilter(fileDiagnostics, collectAllComments(fileData.sourceFile), fileData.source));
  }

  return dedupeDiagnostics(finalized);
}

interface FileDiagnosticData {
  source: string;
  sourceFile: SourceFile;
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
