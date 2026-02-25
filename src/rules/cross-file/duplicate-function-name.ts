import { dirname, resolve } from "node:path";
import type { CrossFileRule, Diagnostic, ProjectIndex } from "../types.ts";

const EXTENSIONS = [".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs"];

export const duplicateFunctionName: CrossFileRule = {
  id: "duplicate-function-name",
  severity: "error",
  message: "Same function name exported from multiple files; consolidate or rename to avoid ambiguity",

  analyze(project: ProjectIndex): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    for (const group of project.functions.getNameCollisionGroups()) {
      // Skip groups already caught by duplicate-function-declaration (identical bodies)
      const hashes = new Set(group.map((e) => e.hash));
      if (hashes.size === 1) continue;

      // Skip wrapper/facade pattern: one file imports the function from another file in the group
      // Also handles barrel re-exports (A imports from barrel, barrel re-exports from B in group)
      const groupFiles = new Set(group.map((e) => e.file));
      const funcName = group[0]!.name;
      const hasImportLink = project.imports.some((imp) => {
        if (!groupFiles.has(imp.file)) return false;
        if (imp.importedName !== funcName && imp.localName !== funcName) return false;
        if (!imp.source.startsWith(".")) return false;
        const candidates = resolveCandidates(imp.file, imp.source);
        // Direct link: import resolves to a file in the group
        if (candidates.some((c) => groupFiles.has(c))) return true;
        // Barrel link: import resolves to an intermediary that re-exports from a group file
        return candidates.some((c) =>
          project.imports.some((reExp) => {
            if (reExp.file !== c) return false;
            if (reExp.importedName !== funcName && reExp.localName !== funcName) return false;
            if (!reExp.source.startsWith(".")) return false;
            const innerCandidates = resolveCandidates(reExp.file, reExp.source);
            return innerCandidates.some((ic) => groupFiles.has(ic));
          }),
        );
      });
      if (hasImportLink) continue;

      const sorted = [...group].sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);
      for (const entry of sorted.slice(1)) {
        const others = sorted
          .filter((e) => e !== entry)
          .map((e) => `${e.file}:${e.line}`)
          .join(", ");
        diagnostics.push({
          ruleId: this.id,
          severity: this.severity,
          message: `Exported function "${entry.name}" also defined in: ${others}`,
          file: entry.file,
          line: entry.line,
          column: 1,
        });
      }
    }
    return diagnostics;
  },
};

function resolveCandidates(fromFile: string, specifier: string): string[] {
  const base = resolve(dirname(fromFile), specifier);
  const candidates = [base];
  for (const ext of EXTENSIONS) {
    candidates.push(base + ext);
    candidates.push(resolve(base, "index" + ext));
  }
  return candidates;
}
