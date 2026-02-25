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
