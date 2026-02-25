import type { CrossFileRule, Diagnostic, ProjectIndex } from "../types.ts";

export const duplicateFunctionDeclaration: CrossFileRule = {
  id: "duplicate-function-declaration",
  severity: "error",
  message: "Identical function body declared in multiple files; consolidate to a single definition",

  analyze(project: ProjectIndex): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    for (const group of project.functions.getDuplicateGroups()) {
      const files = new Set(group.map((e) => e.file));
      if (files.size < 2) continue;

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
