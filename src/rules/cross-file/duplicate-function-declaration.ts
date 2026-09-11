import { type CrossFileAnalysisContext, type CrossFileRule, type Diagnostic, reportDuplicateGroup } from "../types.ts";

export const duplicateFunctionDeclaration: CrossFileRule = {
  id: "duplicate-function-declaration",
  severity: "warning",
  message: "Identical function body declared in multiple files; consolidate to a single definition",
  requiresTypeInfo: false,

  analyze(graph, context: CrossFileAnalysisContext = {}): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    for (const group of graph.duplicateGroups("function")) {
      const first = group[0];
      if (first === undefined || first.statementCount <= 1 || first.isAssignmentOnly) continue;
      const entries = group.map((entry) => ({
        ...entry,
        file: entry.site.file,
        line: entry.site.line,
        column: entry.site.column,
      }));

      reportDuplicateGroup(entries, this.id, this.severity,
        (e) => `${e.name} (${e.file}:${e.line})`,
        (e, others) => `Function "${e.name}" has identical body to: ${others}`,
        diagnostics,
        context);
    }
    return diagnostics;
  },
};
