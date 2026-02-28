import { type CrossFileRule, type Diagnostic, type ProjectIndex, reportDuplicateGroup } from "../types.ts";

export const duplicateInlineTypeInParams: CrossFileRule = {
  id: "duplicate-inline-type-in-params",
  severity: "warning",
  message: "Same inline param type shape appears in multiple places; extract to a shared named type",

  analyze(project: ProjectIndex): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    for (const group of project.inlineParamTypes.getDuplicateGroups()) {
      reportDuplicateGroup(group, this.id, this.severity,
        (e) => `${e.typeText} (${e.file}:${e.line})`,
        (e, others) => `Inline param type \`${e.typeText}\` also appears at: ${others}`,
        diagnostics);
    }
    return diagnostics;
  },
};
