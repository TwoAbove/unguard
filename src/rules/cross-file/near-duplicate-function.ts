import { type CrossFileAnalysisContext, type CrossFileRule, type Diagnostic, reportDuplicateGroup } from "../types.ts";

export const nearDuplicateFunction: CrossFileRule = {
  id: "near-duplicate-function",
  severity: "warning",
  message: "Near-duplicate function bodies across files; consider parameterizing",
  requiresTypeInfo: false,

  analyze(graph, context: CrossFileAnalysisContext = {}): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    for (const group of graph.duplicateGroups("function-normalized")) {
      if (new Set(group.map((entry) => entry.hash)).size < 2) continue;
      const MIN_NORMALIZED_BODY = 32;
      if (group.every((e) => e.normalizedBodyLength < MIN_NORMALIZED_BODY)) continue;
      // Precision-first: tiny wrappers/callbacks are often intentionally repeated.
      if (group.every((entry) => !entry.hasControlFlow && entry.statementCount <= 2)) continue;
      const entries = group.map((entry) => ({
        ...entry,
        file: entry.site.file,
        line: entry.site.line,
        column: entry.site.column,
      }));
      reportDuplicateGroup(entries, this.id, this.severity,
        (e) => `${e.name} (${e.file}:${e.line})`,
        (e, others) => `Function "${e.name}" is near-duplicate of: ${others}`,
        diagnostics,
        context);
    }
    return diagnostics;
  },
};
