import { type CrossFileAnalysisContext, type CrossFileRule, type Diagnostic, type ProjectIndex, reportDuplicateGroup } from "../types.ts";

export const duplicateStatementSequence: CrossFileRule = {
  id: "duplicate-statement-sequence",
  severity: "info",
  message: "Repeated statement sequence; consider extracting to a shared helper",
  requires: ["statementSequences"],

  analyze(project: ProjectIndex, context: CrossFileAnalysisContext = {}): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    const MIN_NORMALIZED_BODY = 128;

    for (const group of project.statementSequences.getNormalizedDuplicateGroups()) {
      if (group.every((e) => e.normalizedBodyLength < MIN_NORMALIZED_BODY)) continue;

      // Deduplicate overlapping windows: keep only the largest per location
      const byLocation = new Map<string, (typeof group)[number]>();
      for (const entry of group) {
        const key = `${entry.file}:${entry.line}`;
        const existing = byLocation.get(key);
        if (existing === undefined || entry.statementCount > existing.statementCount) {
          byLocation.set(key, entry);
        }
      }
      const deduped = [...byLocation.values()];
      if (deduped.length < 2) continue;

      reportDuplicateGroup(deduped, this.id, this.severity,
        (entry) => `${entry.file}:${entry.line}`,
        (entry, others) => `Statement sequence (${entry.statementCount} statements) duplicated at: ${others}`,
        diagnostics,
        context);
    }
    return diagnostics;
  },
};
