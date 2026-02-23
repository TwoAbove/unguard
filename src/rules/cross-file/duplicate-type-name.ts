import type { CrossFileRule, Diagnostic, ProjectIndex } from "../types.ts";

export const duplicateTypeName: CrossFileRule = {
  id: "duplicate-type-name",
  severity: "warning",
  message: "Same type name exported from multiple files; consolidate or rename to avoid ambiguity",

  analyze(project: ProjectIndex): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    for (const group of project.types.getNameCollisionGroups()) {
      // Skip groups already caught by duplicate-type-declaration (identical shapes)
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
          message: `Exported type "${entry.name}" also defined in: ${others}`,
          file: entry.file,
          line: entry.line,
          column: 1,
        });
      }
    }
    return diagnostics;
  },
};
