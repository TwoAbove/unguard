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
}

export interface TSVisitContext {
  report(node: ts.Node, message?: string): void;
  reportAtOffset(offset: number, message?: string): void;
  filename: string;
  source: string;
  sourceFile: ts.SourceFile;
  checker: ts.TypeChecker;
  semantics: SemanticServices;
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
}

export interface CrossFileAnalysisContext {
  /** Files explicitly requested by the scan; project context outside this set is non-reportable. */
  reportableFiles?: ReadonlySet<string>;
}

export type Rule = CrossFileRule | TSRule;

export function isTSRule(r: Rule): r is TSRule {
  return "kind" in r && r.kind === "ts";
}

export function reportDuplicateGroup<T extends { file: string; line: number }>(
  group: T[],
  ruleId: string,
  severity: Diagnostic["severity"],
  formatOther: (entry: T) => string,
  formatMessage: (entry: T, others: string) => string,
  diagnostics: Diagnostic[],
  context: CrossFileAnalysisContext,
): void {
  const sorted = [...group].sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);
  const entries = selectDuplicateReportEntries(sorted, context.reportableFiles);
  for (const entry of entries) {
    const others = sorted
      .filter((e) => e !== entry)
      .map(formatOther)
      .join(", ");
    diagnostics.push({
      ruleId,
      severity,
      message: formatMessage(entry, others),
      file: entry.file,
      line: entry.line,
      column: 1,
    });
  }
}

export function selectReportTarget<T extends { file: string; line: number }>(
  group: T[],
  reportableFiles?: ReadonlySet<string>,
): T | undefined {
  const sorted = [...group].sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);
  if (reportableFiles === undefined) return sorted[0];
  return sorted.find((entry) => reportableFiles.has(entry.file));
}

function selectDuplicateReportEntries<T extends { file: string; line: number }>(
  sorted: T[],
  reportableFiles: ReadonlySet<string> | undefined,
): T[] {
  const defaultEntries = sorted.slice(1);
  if (reportableFiles === undefined) return defaultEntries;

  const reportableDefaultEntries = defaultEntries.filter((entry) => reportableFiles.has(entry.file));
  if (reportableDefaultEntries.length > 0) return reportableDefaultEntries;

  const first = sorted[0];
  if (first !== undefined && sorted.length > 1 && reportableFiles.has(first.file)) return [first];
  return [];
}
