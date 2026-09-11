import { type CrossFileAnalysisContext, type CrossFileRule, type Diagnostic, reportDuplicateGroup } from "../types.ts";

export const duplicateTypeName: CrossFileRule = {
  id: "duplicate-type-name",
  severity: "warning",
  message: "Same type name exported from multiple files; consolidate or rename to avoid ambiguity",
  requiresTypeInfo: false,

  analyze(graph, context: CrossFileAnalysisContext = {}): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    for (const group of graph.nameCollisions("type")) {
      if (new Set(group.map((entry) => entry.hash)).size === 1) continue;
      if (group.some((entry) => entry.form === "other")) continue;

      const entries = group.map((entry) => ({
        ...entry,
        file: entry.site.file,
        line: entry.site.line,
        column: entry.site.column,
      }));
      reportDuplicateGroup(entries, this.id, this.severity,
        (e) => `${e.file}:${e.line}`,
        (e, others) => `Exported type "${e.name}" also defined in: ${others}`,
        diagnostics,
        context);
    }
    return diagnostics;
  },
};
