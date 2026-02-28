import { type CrossFileRule, type Diagnostic, type ProjectIndex, reportDuplicateGroup } from "../types.ts";

export const duplicateTypeDeclaration: CrossFileRule = {
  id: "duplicate-type-declaration",
  severity: "warning",
  message: "Identical type shape declared in multiple files; consolidate to a single definition",

  analyze(project: ProjectIndex): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    for (const group of project.types.getDuplicateGroups()) {
      const files = new Set(group.map((e) => e.file));
      if (files.size < 2) continue;
      reportDuplicateGroup(group, this.id, this.severity,
        (e) => `${e.name} (${e.file}:${e.line})`,
        (e, others) => `Type "${e.name}" has identical shape to: ${others}`,
        diagnostics);
    }
    return diagnostics;
  },
};
