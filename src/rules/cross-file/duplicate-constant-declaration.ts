import { type CrossFileRule, type Diagnostic, type ProjectIndex, reportDuplicateGroup } from "../types.ts";

export const duplicateConstantDeclaration: CrossFileRule = {
  id: "duplicate-constant-declaration",
  severity: "warning",
  message: "Identical constant value declared in multiple files; consolidate to a single definition",

  analyze(project: ProjectIndex): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    for (const group of project.constants.getDuplicateGroups()) {
      const files = new Set(group.map((e) => e.file));
      if (files.size < 2) continue;
      reportDuplicateGroup(group, this.id, this.severity,
        (e) => `${e.name} (${e.file}:${e.line})`,
        (e, others) => `Constant "${e.name}" has identical value \`${e.valueText}\` to: ${others}`,
        diagnostics);
    }
    return diagnostics;
  },
};
