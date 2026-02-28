import type { CrossFileRule, Diagnostic, ProjectIndex } from "../types.ts";

export const duplicateFile: CrossFileRule = {
  id: "duplicate-file",
  severity: "warning",
  message: "File has identical content to another file; one is likely dead code",

  analyze(project: ProjectIndex): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    for (const files of project.fileHashes.values()) {
      if (files.length < 2) continue;
      const sorted = [...files].sort();
      for (const file of sorted.slice(1)) {
        const others = sorted.filter((f) => f !== file).join(", ");
        diagnostics.push({
          ruleId: this.id,
          severity: this.severity,
          message: `File is identical to: ${others}`,
          file,
          line: 1,
          column: 1,
        });
      }
    }
    return diagnostics;
  },
};
