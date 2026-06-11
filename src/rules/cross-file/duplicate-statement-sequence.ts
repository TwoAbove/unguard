import { type CrossFileAnalysisContext, type CrossFileRule, type Diagnostic, type ProjectIndex, reportDuplicateGroup } from "../types.ts";

export const duplicateStatementSequence: CrossFileRule = {
  id: "duplicate-statement-sequence",
  severity: "warning",
  message: "Repeated statement sequence; consider extracting to a shared helper",
  requires: ["statementSequences"],

  // The registry returns maximal matches (longest run of consecutive statements
  // shared by ≥2 locations, can't extend in either direction). That format
  // describes "this block is duplicated" in the same shape the developer would
  // describe it — no overlapping window noise, no sub-windows of a larger match.
  //
  // The structural check that varies-only-by-literals (lookup/dispatch tables)
  // doesn't duplicate is preserved by the hashing primitive: each statement is
  // hashed as comment-stripped text with identifiers AND literals retained, so
  // two `set("alpha", 1)` and `set("beta", 2)` statements have different hashes.
  // Function-level near-duplication with renamed identifiers belongs to
  // near-duplicate-function, not here.
  analyze(project: ProjectIndex, context: CrossFileAnalysisContext = {}): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    const MIN_STATEMENT_COUNT = 3;
    const MIN_NORMALIZED_BODY = 128;

    for (const match of project.statementSequences.getMaximalMatches(
      MIN_STATEMENT_COUNT,
      MIN_NORMALIZED_BODY,
    )) {
      reportDuplicateGroup(
        match.participants,
        this.id,
        this.severity,
        (entry) => `${entry.file}:${entry.line}`,
        (_entry, others) =>
          `Statement sequence (${match.statementCount} statements) appears ${match.participants.length} times; also at: ${others}`,
        diagnostics,
        context,
      );
    }
    return diagnostics;
  },
};
