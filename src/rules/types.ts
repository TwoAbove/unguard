import type * as ts from "typescript";

export interface SemanticServices {
  checker: ts.TypeChecker;
  typeAtLocation(node: ts.Node): ts.Type;
  symbolAtLocation(node: ts.Node): ts.Symbol | undefined;
  resolvedSignature(node: ts.CallLikeExpression): ts.Signature | undefined;
  typeFromTypeNode(node: ts.TypeNode): ts.Type;
  contextualType(node: ts.Expression): ts.Type | undefined;
  typeOfSymbolAtLocation(symbol: ts.Symbol, node: ts.Node): ts.Type;
  aliasedSymbol(symbol: ts.Symbol): ts.Symbol;
  awaitedType(type: ts.Type): ts.Type | undefined;
  apparentType(type: ts.Type): ts.Type;
  isArrayType(type: ts.Type): boolean;
  isTupleType(type: ts.Type): boolean;
  isTypeAssignableTo(source: ts.Type, target: ts.Type): boolean;
}

export interface Diagnostic {
  ruleId: string;
  severity: "info" | "warning" | "error";
  message: string;
  file: string;
  line: number;
  column: number;
  annotation?: string;
  fix?: FixEdit;
}

/**
 * A single text replacement with absolute offsets into the file's source.
 * Only attach a fix when the replacement is provably semantics-preserving;
 * `--fix` applies these mechanically.
 */
export interface FixEdit {
  start: number;
  end: number;
  text: string;
}

export interface TSVisitContext {
  report(node: ts.Node, message?: string, fix?: FixEdit): void;
  reportAtOffset(offset: number, message?: string): void;
  filename: string;
  source: string;
  sourceFile: ts.SourceFile;
  checker: ts.TypeChecker;
  semantics: SemanticServices;
  compilerOptions: ts.CompilerOptions;
  isNullable(node: ts.Node): boolean;
  isExternal(node: ts.Node): boolean;
}

export interface TSRule {
  kind: "ts";
  id: string;
  severity: "info" | "warning" | "error";
  message: string;
  /** Restrict visits to these node kinds. Omit only for rules that truly need every node. */
  syntaxKinds?: readonly ts.SyntaxKind[];
  /** Defaults to true. Set false only when the rule never touches checker/isNullable/isExternal. */
  requiresTypeInfo?: boolean;
  /**
   * Set true when the rule's reasoning collapses without `strictNullChecks`:
   * every type reads as non-nullable, inverting "this guard is dead" into
   * advice to delete load-bearing guards. Such rules are skipped (with a
   * notice) when the analyzed project has strictNullChecks off.
   */
  requiresStrictNullChecks?: boolean;
  visit(node: ts.Node, ctx: TSVisitContext): void;
}

import type { ProjectIndex } from "../collect/index.ts";
export type { ProjectIndex };

export type ProjectIndexNeed =
  | "files"
  | "types"
  | "functions"
  | "functionSymbols"
  | "constants"
  | "callSites"
  | "callSiteSymbols"
  | "overloadCallSignatures"
  | "imports"
  | "fileHashes"
  | "statementSequences"
  | "inlineParamTypes";

export interface CrossFileRule {
  id: string;
  severity: "info" | "warning" | "error";
  message: string;
  requires?: readonly ProjectIndexNeed[];
  analyze(project: ProjectIndex, context?: CrossFileAnalysisContext): Diagnostic[];
  /**
   * Cross-group merge, both hooks or neither. Analysis runs one tsconfig
   * group at a time; a rule that would mistake another group's usage for
   * absence (e.g. unused-export in a monorepo) implements these instead of
   * relying on `analyze` alone. `collectGlobalFacts` runs per group — possibly
   * in a worker, so facts must survive structuredClone (no ts.Node/ts.Symbol).
   * `finalizeGlobal` runs once on the main thread with every group's facts.
   */
  collectGlobalFacts?(project: ProjectIndex, context?: CrossFileAnalysisContext): unknown;
  finalizeGlobal?(facts: unknown[]): Diagnostic[];
}

export interface CrossFileAnalysisContext {
  /** Files explicitly requested by the scan; project context outside this set is non-reportable. */
  reportableFiles?: ReadonlySet<string>;
}

export type Rule = CrossFileRule | TSRule;

export function isTSRule(r: Rule): r is TSRule {
  return "kind" in r && r.kind === "ts";
}

/**
 * Emit ONE diagnostic per group of duplicates, not N-1.
 *
 * Each duplicate-* rule represents a single refactor decision per group
 * (extract a helper, unify the type, name the constant). Emitting per site
 * would inflate the issue count to (group size − 1) for what is one fix,
 * and IDE squiggle navigation is preserved by listing every location in the
 * message.
 *
 * Diagnostic location: the first non-canonical, reportable occurrence (the
 * "first copy"). This preserves @expect-on-the-copy semantics in tests where
 * fixtures historically marked the second occurrence.
 */
export function reportDuplicateGroup<T extends DuplicateGroupEntry>(
  group: T[],
  ruleId: string,
  severity: Diagnostic["severity"],
  formatOther: (entry: T) => string,
  formatMessage: (entry: T, others: string) => string,
  diagnostics: Diagnostic[],
  context: CrossFileAnalysisContext,
): void {
  const sorted = [...group].sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);
  const target = selectDuplicateReportTarget(sorted, context.reportableFiles);
  if (target === undefined) return;
  const others = sorted
    .filter((e) => e !== target)
    .map(formatOther)
    .join(", ");
  diagnostics.push({
    ruleId,
    severity,
    message: formatMessage(target, others),
    file: target.file,
    line: target.line,
    column: target.column ?? 1,
  });
}

export interface DuplicateGroupEntry {
  file: string;
  line: number;
  /** Optional 1-based column to host the diagnostic. Defaults to 1 when omitted. */
  column?: number;
}

export function selectReportTarget<T extends { file: string; line: number }>(
  group: T[],
  reportableFiles?: ReadonlySet<string>,
): T | undefined {
  const sorted = [...group].sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);
  if (reportableFiles === undefined) return sorted[0];
  return sorted.find((entry) => reportableFiles.has(entry.file));
}

/**
 * Choose the one entry to host the diagnostic. Prefer the first "copy"
 * (sorted index 1) so we point at duplication rather than at the canonical
 * declaration. Fall back to the canonical when it's the only reportable site.
 */
function selectDuplicateReportTarget<T extends { file: string; line: number }>(
  sorted: T[],
  reportableFiles: ReadonlySet<string> | undefined,
): T | undefined {
  if (sorted.length < 2) return undefined;
  if (reportableFiles === undefined) return sorted[1];

  for (let i = 1; i < sorted.length; i++) {
    const entry = sorted[i];
    if (entry !== undefined && reportableFiles.has(entry.file)) return entry;
  }
  const first = sorted[0];
  if (first !== undefined && reportableFiles.has(first.file)) return first;
  return undefined;
}
