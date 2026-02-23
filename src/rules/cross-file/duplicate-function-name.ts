import type { CrossFileRule, Diagnostic, ProjectIndex } from "../types.ts";

export const duplicateFunctionName: CrossFileRule = {
  id: "duplicate-function-name",
  severity: "warning",
  message: "Same function name exported from multiple files; consolidate or rename to avoid ambiguity",

  analyze(project: ProjectIndex): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    for (const group of project.functions.getNameCollisionGroups()) {
      // Skip groups already caught by duplicate-function-declaration (identical bodies)
      const hashes = new Set(group.map((e) => e.hash));
      if (hashes.size === 1) continue;

      for (const entry of group) {
        const others = group
          .filter((e) => e !== entry)
          .map((e) => `${e.file}:${e.line}`)
          .join(", ");
        diagnostics.push({
          ruleId: this.id,
          severity: this.severity,
          message: `Exported function "${entry.name}" also defined in: ${others}`,
          file: entry.file,
          line: entry.line,
          column: 1,
        });
      }
    }
    return diagnostics;
  },
};
