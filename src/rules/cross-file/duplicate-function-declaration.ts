import * as ts from "typescript";
import type { CrossFileRule, Diagnostic, ProjectIndex } from "../types.ts";

export const duplicateFunctionDeclaration: CrossFileRule = {
  id: "duplicate-function-declaration",
  severity: "warning",
  message: "Identical function body declared in multiple files; consolidate to a single definition",

  analyze(project: ProjectIndex): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    for (const group of project.functions.getDuplicateGroups()) {
      const files = new Set(group.map((e) => e.file));
      if (files.size < 2) continue;

      // Skip setter pattern: single-assignment body (e.g. `botApi = api`)
      // These close over different module-scoped variables despite identical body text
      const first = group[0];
      if (first !== undefined && isSetter(first.node)) continue;

      const sorted = [...group].sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);
      for (const entry of sorted.slice(1)) {
        const others = sorted
          .filter((e) => e !== entry)
          .map((e) => `${e.name} (${e.file}:${e.line})`)
          .join(", ");
        diagnostics.push({
          ruleId: this.id,
          severity: this.severity,
          message: `Function "${entry.name}" has identical body to: ${others}`,
          file: entry.file,
          line: entry.line,
          column: 1,
        });
      }
    }
    return diagnostics;
  },
};

function isSetter(node: ts.Node): boolean {
  let body: ts.Block | undefined;
  if (ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node)) {
    body = node.body;
  } else if (ts.isArrowFunction(node)) {
    body = ts.isBlock(node.body) ? node.body : undefined;
  }
  if (!body || body.statements.length !== 1) return false;
  const stmt = body.statements[0];
  if (stmt === undefined || !ts.isExpressionStatement(stmt)) return false;
  return ts.isBinaryExpression(stmt.expression) &&
    stmt.expression.operatorToken.kind === ts.SyntaxKind.EqualsToken;
}
