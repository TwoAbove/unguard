import { dirname, resolve } from "node:path";
import { type CrossFileAnalysisContext, type CrossFileRule, type Diagnostic, type ProjectIndex, reportDuplicateGroup } from "../types.ts";

const EXTENSIONS = [".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs"];

export const duplicateFunctionName: CrossFileRule = {
  id: "duplicate-function-name",
  severity: "warning",
  message: "Same function name exported from multiple files; consolidate or rename to avoid ambiguity",
  requires: ["functions", "imports"],

  analyze(project: ProjectIndex, context: CrossFileAnalysisContext = {}): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    for (const group of project.functions.getNameCollisionGroups()) {
      const hashes = new Set(group.map((e) => e.hash));
      if (hashes.size === 1) continue;

      const groupFiles = new Set(group.map((e) => e.file));
      const first = group[0];
      if (first === undefined) continue;
      const funcName = first.name;
      const hasImportLink = project.imports.some((imp) => {
        if (!groupFiles.has(imp.file)) return false;
        if (imp.importedName !== funcName && imp.localName !== funcName) return false;
        if (!imp.source.startsWith(".")) return false;
        const candidates = resolveCandidates(imp.file, imp.source);
        if (candidates.some((c) => groupFiles.has(c))) return true;
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

      reportDuplicateGroup(group, this.id, this.severity,
        (e) => `${e.file}:${e.line}`,
        (e, others) => `Exported function "${e.name}" also defined in: ${others}`,
        diagnostics,
        context);
    }
    return diagnostics;
  },
};

function resolveCandidates(fromFile: string, specifier: string): string[] {
  const base = resolve(dirname(fromFile), specifier);
  const candidates = [base];
  for (const ext of EXTENSIONS) {
    candidates.push(base + ext);
    candidates.push(resolve(base, `index${ext}`));
  }
  return candidates;
}
