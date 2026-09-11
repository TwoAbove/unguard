import type { Graph, NodeId } from "../../graph/types.ts";
import type { CrossFileAnalysisContext, CrossFileRule, Diagnostic } from "../types.ts";

/**
 * Analysis runs per tsconfig group, so from inside one group an export
 * consumed only by a sibling package looks unused. This rule therefore
 * merges across groups: each group contributes its locally-unused export
 * candidates plus resolved import keys and called declaration identities, and
 * the final pass drops any candidate another group proved alive. Still
 * heuristic — consumers outside the scanned tree (published API surface,
 * unresolved dynamic access) are invisible to the analysis.
 */
export const unusedExport: CrossFileRule = {
  id: "unused-export",
  severity: "warning",
  message: "Export has no usages within the project",

  collectGlobalFacts(graph: Graph, context?: CrossFileAnalysisContext): UnusedExportFacts {
    return collectFacts(graph, context);
  },

  finalizeGlobal(facts: unknown[]): Diagnostic[] {
    return finalize(facts as UnusedExportFacts[], this.severity);
  },

  analyze(graph: Graph, context?: CrossFileAnalysisContext): Diagnostic[] {
    return finalize([collectFacts(graph, context)], this.severity);
  },
};

interface ExportCandidate {
  declaration: NodeId;
  file: string;
  exportName: string;
  displayName: string;
  kindLabel: string;
  line: number;
}

interface UnusedExportFacts {
  candidates: ExportCandidate[];
  /** `${file}\0${exportName}` keys proven used by resolved imports. */
  usedKeys: string[];
  /** Canonical source declaration IDs proven used by resolved calls. */
  usedDeclarations: NodeId[];
  wildcardImportedFiles: string[];
}

interface ExportDeclaration {
  name: string;
  kindLabel: "function" | "type" | "constant";
  line: number;
}

function collectFacts(graph: Graph, context: CrossFileAnalysisContext | undefined): UnusedExportFacts {
  const imports = graph.imports();
  const usedKeys = new Set<string>();
  const wildcardImportedFiles = new Set<string>();
  const usedDeclarations = new Set<NodeId>();

  for (const call of graph.calls()) {
    if (call.callee !== null) usedDeclarations.add(call.callee);
  }

  for (const imp of imports) {
    if (imp.resolvedFile === null) continue;
    if (imp.kind === "namespace" || imp.kind === "reexport-star") {
      wildcardImportedFiles.add(imp.resolvedFile);
      continue;
    }
    usedKeys.add(exportKey(imp.resolvedFile, imp.kind === "default" ? "default" : imp.importedName));
  }

  const declarations = new Map<NodeId, ExportDeclaration>();
  for (const fn of graph.functions()) {
    declarations.set(fn.id, { name: fn.name, kindLabel: "function", line: fn.site.line });
  }
  for (const type of graph.types()) {
    declarations.set(type.id, { name: type.name, kindLabel: "type", line: type.site.line });
  }
  for (const constant of graph.constants()) {
    declarations.set(constant.id, { name: constant.name, kindLabel: "constant", line: constant.site.line });
  }

  const reportable = context?.reportableFiles;
  const candidates: ExportCandidate[] = [];

  for (const exported of graph.exports()) {
    if (exported.kind !== "function" && exported.kind !== "type" && exported.kind !== "constant") continue;
    if (reportable !== undefined && !reportable.has(exported.file)) continue;
    if (isEntryPoint(exported.file)) continue;
    if (wildcardImportedFiles.has(exported.file)) continue;

    const declaration = declarations.get(exported.decl);
    if (declaration === undefined) continue;
    if (graph.readers(exported.decl).length > 0) continue;
    if (usedKeys.has(exportKey(exported.file, exported.name))) continue;

    candidates.push({
      declaration: exported.decl,
      file: exported.file,
      exportName: exported.name,
      displayName: declaration.name,
      kindLabel: declaration.kindLabel,
      line: declaration.line,
    });
  }

  return {
    candidates,
    usedKeys: [...usedKeys],
    usedDeclarations: [...usedDeclarations],
    wildcardImportedFiles: [...wildcardImportedFiles],
  };
}

function finalize(factsList: UnusedExportFacts[], severity: Diagnostic["severity"]): Diagnostic[] {
  const used = new Set<string>();
  const usedDeclarations = new Set<NodeId>();
  const wildcard = new Set<string>();
  for (const facts of factsList) {
    for (const key of facts.usedKeys) used.add(key);
    for (const declaration of facts.usedDeclarations) usedDeclarations.add(declaration);
    for (const file of facts.wildcardImportedFiles) wildcard.add(file);
  }

  const diagnostics: Diagnostic[] = [];
  const seen = new Set<string>();
  for (const facts of factsList) {
    for (const candidate of facts.candidates) {
      const key = exportKey(candidate.file, candidate.exportName);
      if (seen.has(key)) continue;
      seen.add(key);
      if (used.has(key)) continue;
      if (usedDeclarations.has(candidate.declaration)) continue;
      if (wildcard.has(candidate.file)) continue;

      diagnostics.push({
        ruleId: unusedExport.id,
        severity,
        message: `Exported ${candidate.kindLabel} "${candidate.displayName}" has no usages in the project`,
        file: candidate.file,
        line: candidate.line,
        column: 1,
      });
    }
  }
  return diagnostics;
}


function isEntryPoint(file: string): boolean {
  if (/\/index\.[cm]?[jt]sx?$/.test(file)) return true;
  return /\/bin\//.test(file);
}

function exportKey(file: string, name: string): string {
  return `${file}\0${name}`;
}
