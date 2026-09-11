import { type CrossFileAnalysisContext, type CrossFileRule, type Diagnostic, reportDuplicateGroup } from "../types.ts";

export const duplicateFile: CrossFileRule = {
  id: "duplicate-file",
  severity: "warning",
  message: "File has identical content to another file; one is likely dead code",
  requiresTypeInfo: false,

  analyze(graph, context: CrossFileAnalysisContext = {}): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    for (const files of graph.duplicateGroups("file")) {
      const group = files.map(({ file }) => ({ file, line: 1 }));
      reportDuplicateGroup(group, this.id, this.severity,
        (entry) => entry.file,
        (_entry, others) => `File is identical to: ${others}`,
        diagnostics,
        context);
    }
    return diagnostics;
  },
};
