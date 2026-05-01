import { type CrossFileAnalysisContext, type CrossFileRule, type Diagnostic, type ProjectIndex, reportDuplicateGroup } from "../types.ts";

export const duplicateFile: CrossFileRule = {
  id: "duplicate-file",
  severity: "warning",
  message: "File has identical content to another file; one is likely dead code",
  requires: ["fileHashes"],

  analyze(project: ProjectIndex, context: CrossFileAnalysisContext = {}): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    for (const files of project.fileHashes.values()) {
      if (files.length < 2) continue;
      const group = files.map((file) => ({ file, line: 1 }));
      reportDuplicateGroup(group, this.id, this.severity,
        (entry) => entry.file,
        (_entry, others) => `File is identical to: ${others}`,
        diagnostics,
        context);
    }
    return diagnostics;
  },
};
