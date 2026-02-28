import { type CrossFileRule, type Diagnostic, type ProjectIndex, reportDuplicateGroup } from "../types.ts";

export const nearDuplicateFunction: CrossFileRule = {
  id: "near-duplicate-function",
  severity: "warning",
  message: "Near-duplicate function bodies across files; consider parameterizing",

  analyze(project: ProjectIndex): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    for (const group of project.functions.getNearDuplicateGroups()) {
      const MIN_NORMALIZED_BODY = 32;
      if (group.every((e) => e.normalizedBodyLength < MIN_NORMALIZED_BODY)) continue;
      reportDuplicateGroup(group, this.id, this.severity,
        (e) => `${e.name} (${e.file}:${e.line})`,
        (e, others) => `Function "${e.name}" is near-duplicate of: ${others}`,
        diagnostics);
    }
    return diagnostics;
  },
};
