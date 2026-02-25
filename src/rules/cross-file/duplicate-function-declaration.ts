import type { CrossFileRule, Diagnostic, ProjectIndex } from "../types.ts";
import { child, children, prop } from "../../utils/narrow.ts";

export const duplicateFunctionDeclaration: CrossFileRule = {
  id: "duplicate-function-declaration",
  severity: "error",
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

function isSetter(node: Node): boolean {
  // For FunctionDeclaration/FunctionExpression, body is a BlockStatement
  let body = child(node, "body");
  // For VariableDeclarator with arrow function, dig into init
  if (body === null) {
    const init = child(node, "init");
    if (init !== null) body = child(init, "body");
  }
  if (body === null || body.type !== "BlockStatement") return false;
  const stmts = children(body, "body");
  if (stmts.length !== 1) return false;
  const stmt = stmts[0];
  if (stmt === undefined || stmt.type !== "ExpressionStatement") return false;
  const expr = child(stmt, "expression");
  return expr !== null && expr.type === "AssignmentExpression";
}
