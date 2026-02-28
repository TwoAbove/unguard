import type * as ts from "typescript";

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
  isNullable(node: ts.Node): boolean;
  isExternal(node: ts.Node): boolean;
}

export interface TSRule {
  kind: "ts";
  id: string;
  severity: "info" | "warning" | "error";
  message: string;
  visit(node: ts.Node, ctx: TSVisitContext): void;
}

import type { ProjectIndex } from "../collect/index.ts";
export type { ProjectIndex };

export interface CrossFileRule {
  id: string;
  severity: "info" | "warning" | "error";
  message: string;
  analyze(project: ProjectIndex): Diagnostic[];
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
): void {
  const sorted = [...group].sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);
  for (const entry of sorted.slice(1)) {
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
