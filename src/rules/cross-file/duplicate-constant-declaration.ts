import type { ConstantFact } from "../../graph/types.ts";
import { type CrossFileAnalysisContext, type CrossFileRule, type Diagnostic, reportDuplicateGroup } from "../types.ts";

/**
 * Iffy by this project's own standard: `hasNameOverlap` gates on identifier
 * name segments, so renaming a constant changes the diagnostics — a sanctioned
 * violation of the "structure and types, never names" hard rule. Without the
 * gate, every unrelated pair of `100`s across the project would group. Kept at
 * `info` severity to reflect that reduced confidence.
 */
export const duplicateConstantDeclaration: CrossFileRule = {
  id: "duplicate-constant-declaration",
  severity: "info",
  message: "Identical constant value declared in multiple files; consolidate to a single definition",
  requiresTypeInfo: false,

  analyze(graph, context: CrossFileAnalysisContext = {}): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    for (const group of graph.duplicateGroups("constant")) {
      if (new Set(group.map((entry) => entry.site.file)).size < 2) continue;
      if (!hasNameOverlap(group)) continue;
      const entries = group.map((entry) => ({
        ...entry,
        file: entry.site.file,
        line: entry.site.line,
        column: entry.site.column,
      }));
      reportDuplicateGroup(entries, this.id, this.severity,
        (e) => `${e.name} (${e.file}:${e.line})`,
        (e, others) => `Constant "${e.name}" has identical value \`${e.valueText}\` to: ${others}`,
        diagnostics,
        context);
    }
    return diagnostics;
  },
};

/** Check whether any two constants in the group share a name segment. */
function hasNameOverlap(group: readonly ConstantFact[]): boolean {
  const segmentSets = group.map((e) => nameSegments(e.name));
  for (let i = 0; i < segmentSets.length; i++) {
    const left = segmentSets[i];
    if (left === undefined) continue;
    for (let j = i + 1; j < segmentSets.length; j++) {
      const right = segmentSets[j];
      if (right === undefined) continue;
      for (const seg of left) {
        if (right.has(seg)) return true;
      }
    }
  }
  return false;
}

/** Split a constant name into lowercase segments on _ and camelCase boundaries. */
function nameSegments(name: string): Set<string> {
  const segments = new Set<string>();
  for (const part of name.split("_")) {
    for (const seg of part.split(/(?<=[a-z])(?=[A-Z])/)) {
      const lower = seg.toLowerCase();
      if (lower.length > 0) segments.add(lower);
    }
  }
  return segments;
}
