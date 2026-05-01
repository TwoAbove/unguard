import * as ts from "typescript";
import type { FunctionEntry } from "../../collect/function-registry.ts";
import { type CrossFileAnalysisContext, type CrossFileRule, type Diagnostic, type ProjectIndex, reportDuplicateGroup } from "../types.ts";

export const nearDuplicateFunction: CrossFileRule = {
  id: "near-duplicate-function",
  severity: "warning",
  message: "Near-duplicate function bodies across files; consider parameterizing",
  requires: ["functions"],

  analyze(project: ProjectIndex, context: CrossFileAnalysisContext = {}): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    for (const group of project.functions.getNearDuplicateGroups()) {
      const MIN_NORMALIZED_BODY = 32;
      if (group.every((e) => e.normalizedBodyLength < MIN_NORMALIZED_BODY)) continue;
      // Precision-first: tiny wrappers/callbacks are often intentionally repeated.
      if (group.every(isSimpleStructure)) continue;
      reportDuplicateGroup(group, this.id, this.severity,
        (e) => `${e.name} (${e.file}:${e.line})`,
        (e, others) => `Function "${e.name}" is near-duplicate of: ${others}`,
        diagnostics,
        context);
    }
    return diagnostics;
  },
};

function getFunctionBody(node: ts.Node): ts.Block | ts.Expression | undefined {
  if (ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node)) return node.body;
  if (ts.isArrowFunction(node)) return node.body;
  if (ts.isMethodDeclaration(node)) return node.body;
  return undefined;
}

function getTopLevelStatementCount(body: ts.Block | ts.Expression): number {
  if (ts.isBlock(body)) return body.statements.length;
  return 1;
}

function hasControlFlow(node: ts.Node): boolean {
  let found = false;
  function visit(current: ts.Node): void {
    if (found) return;
    if (
      ts.isIfStatement(current) ||
      ts.isSwitchStatement(current) ||
      ts.isTryStatement(current) ||
      ts.isForStatement(current) ||
      ts.isForInStatement(current) ||
      ts.isForOfStatement(current) ||
      ts.isWhileStatement(current) ||
      ts.isDoStatement(current)
    ) {
      found = true;
      return;
    }
    ts.forEachChild(current, visit);
  }
  visit(node);
  return found;
}

function isSimpleStructure(entry: FunctionEntry): boolean {
  const body = getFunctionBody(entry.node);
  if (!body) return false;
  if (hasControlFlow(body)) return false;
  return getTopLevelStatementCount(body) <= 2;
}
