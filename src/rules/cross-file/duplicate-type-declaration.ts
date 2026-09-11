import { type CrossFileAnalysisContext, type CrossFileRule, type Diagnostic, reportDuplicateGroup } from "../types.ts";

export const duplicateTypeDeclaration: CrossFileRule = {
  id: "duplicate-type-declaration",
  severity: "warning",
  message: "Identical type shape declared in multiple files; consolidate to a single definition",
  requiresTypeInfo: false,

  analyze(graph, context: CrossFileAnalysisContext = {}): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    for (const group of graph.duplicateGroups("type")) {
      if (new Set(group.map((entry) => entry.site.file)).size < 2) continue;
      if (group.every((entry) => entry.memberCount <= 1 && entry.form !== "other")) continue;
      const entries = group.map((entry) => ({
        ...entry,
        file: entry.site.file,
        line: entry.site.line,
        column: entry.site.column,
      }));
      reportDuplicateGroup(entries, this.id, this.severity,
        (e) => `${e.name} (${e.file}:${e.line})`,
        (e, others) => `Type "${e.name}" has identical shape to: ${others}`,
        diagnostics,
        context);
    }
    return diagnostics;
  },
};
