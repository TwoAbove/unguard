import type { CrossFileRule, Diagnostic, ProjectIndex } from "../types.ts";

export const duplicateStatementSequence: CrossFileRule = {
  id: "duplicate-statement-sequence",
  severity: "info",
  message: "Repeated statement sequence; consider extracting to a shared helper",

  analyze(project: ProjectIndex): Diagnostic[] {
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

      const sorted = deduped.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);
      for (const entry of sorted.slice(1)) {
        const others = sorted
          .filter((e) => e !== entry)
          .map((e) => `${e.file}:${e.line}`)
          .join(", ");
        diagnostics.push({
          ruleId: this.id,
          severity: this.severity,
          message: `Statement sequence (${entry.statementCount} statements) duplicated at: ${others}`,
          file: entry.file,
          line: entry.line,
          column: 1,
        });
      }
    }
    return diagnostics;
  },
};
