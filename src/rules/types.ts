import type { Node, Comment } from "oxc-parser";

export interface Diagnostic {
  ruleId: string;
  severity: "info" | "warning" | "error";
  message: string;
  file: string;
  line: number;
  column: number;
  annotation?: string;
}

export interface Span {
  start: number;
  end: number;
}

export interface VisitContext {
  report(span: Span, message?: string): void;
  filename: string;
  source: string;
}

export interface SingleFileRule {
  id: string;
  severity: "info" | "warning" | "error";
  message: string;
  visit(node: Node, parent: Node | null, ctx: VisitContext): void;
  visitComment?(comment: Comment, ctx: VisitContext): void;
}

import type { ProjectIndex } from "../collect/index.ts";
export type { ProjectIndex };

export interface CrossFileRule {
  id: string;
  severity: "info" | "warning" | "error";
  message: string;
  analyze(project: ProjectIndex): Diagnostic[];
}

export type Rule = SingleFileRule | CrossFileRule;

export function isSingleFileRule(r: Rule): r is SingleFileRule {
  return "visit" in r;
}
