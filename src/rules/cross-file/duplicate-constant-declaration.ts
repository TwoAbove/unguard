import type { ConstantEntry } from "../../collect/constant-registry.ts";
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
      if (!hasNameOverlap(group)) continue;
      reportDuplicateGroup(group, this.id, this.severity,
        (e) => `${e.name} (${e.file}:${e.line})`,
        (e, others) => `Constant "${e.name}" has identical value \`${e.valueText}\` to: ${others}`,
        diagnostics);
    }
    return diagnostics;
  },
};

/** Check whether any two constants in the group share a name segment. */
function hasNameOverlap(group: ConstantEntry[]): boolean {
  const segmentSets = group.map((e) => nameSegments(e.name));
  for (let i = 0; i < segmentSets.length; i++) {
    for (let j = i + 1; j < segmentSets.length; j++) {
      for (const seg of segmentSets[i]!) {
        if (segmentSets[j]!.has(seg)) return true;
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
