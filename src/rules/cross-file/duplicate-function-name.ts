import { type CrossFileAnalysisContext, type CrossFileRule, type Diagnostic, reportDuplicateGroup } from "../types.ts";

export const duplicateFunctionName: CrossFileRule = {
  id: "duplicate-function-name",
  severity: "warning",
  message: "Same function name exported from multiple files; consolidate or rename to avoid ambiguity",
  requiresTypeInfo: false,

  analyze(graph, context: CrossFileAnalysisContext = {}): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    const imports = graph.imports();
    for (const group of graph.nameCollisions("function")) {
      if (new Set(group.map((entry) => entry.hash)).size === 1) continue;

      const groupFiles = new Set(group.map((entry) => entry.site.file));
      const first = group[0];
      if (first === undefined) continue;
      const name = first.name;
      const hasImportLink = imports.some((imp) => {
        if (!groupFiles.has(imp.file)) return false;
        if (imp.importedName !== name && imp.localName !== name) return false;
        if (imp.resolvedFile === null) return false;
        if (groupFiles.has(imp.resolvedFile)) return true;
        return imports.some((reExport) =>
          reExport.file === imp.resolvedFile &&
          (reExport.importedName === name || reExport.localName === name) &&
          reExport.resolvedFile !== null &&
          groupFiles.has(reExport.resolvedFile)
        );
      });
      if (hasImportLink) continue;

      const entries = group.map((entry) => ({
        ...entry,
        file: entry.site.file,
        line: entry.site.line,
        column: entry.site.column,
      }));
      reportDuplicateGroup(entries, this.id, this.severity,
        (e) => `${e.file}:${e.line}`,
        (e, others) => `Exported function "${e.name}" also defined in: ${others}`,
        diagnostics,
        context);
    }
    return diagnostics;
  },
};
