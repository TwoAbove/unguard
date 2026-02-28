import * as ts from "typescript";
import { type CrossFileRule, type Diagnostic, type ProjectIndex, reportDuplicateGroup } from "../types.ts";

export const duplicateFunctionDeclaration: CrossFileRule = {
  id: "duplicate-function-declaration",
  severity: "warning",
  message: "Identical function body declared in multiple files; consolidate to a single definition",

  analyze(project: ProjectIndex): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    for (const group of project.functions.getDuplicateGroups()) {
      const first = group[0];
      if (first === undefined) continue;
      if (isSingleStatement(first.node)) continue;
      if (isSetter(first.node)) continue;

      reportDuplicateGroup(group, this.id, this.severity,
        (e) => `${e.name} (${e.file}:${e.line})`,
        (e, others) => `Function "${e.name}" has identical body to: ${others}`,
        diagnostics);
    }
    return diagnostics;
  },
};

function getBodyBlock(node: ts.Node): ts.Block | undefined {
  if (ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node)) return node.body;
  if (ts.isArrowFunction(node)) return ts.isBlock(node.body) ? node.body : undefined;
  if (ts.isMethodDeclaration(node)) return node.body;
  return undefined;
}

function isSingleStatement(node: ts.Node): boolean {
  const body = getBodyBlock(node);
  return body !== undefined && body.statements.length <= 1;
}

function isSetter(node: ts.Node): boolean {
  const body = getBodyBlock(node);
  if (!body || body.statements.length !== 1) return false;
  const stmt = body.statements[0];
  if (stmt === undefined || !ts.isExpressionStatement(stmt)) return false;
  return ts.isBinaryExpression(stmt.expression) &&
    stmt.expression.operatorToken.kind === ts.SyntaxKind.EqualsToken;
}
