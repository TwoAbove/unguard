import * as path from "node:path";
import * as ts from "typescript";
import type { CrossFileAnalysisContext, CrossFileRule, Diagnostic, ProjectIndex } from "../types.ts";

/**
 * Analysis runs per tsconfig group, so from inside one group an export
 * consumed only by a sibling package looks unused. This rule therefore
 * merges across groups: each group contributes its locally-unused export
 * candidates plus every usage fact it can see (imports it resolves, call
 * sites it binds), and the final pass drops any candidate some other group
 * proved alive. Still heuristic — consumers outside the scanned tree
 * (published API surface, dynamic access) are invisible to any program.
 */
export const unusedExport: CrossFileRule = {
  id: "unused-export",
  severity: "warning",
  message: "Export has no usages within the project",
  requires: ["functions", "functionSymbols", "callSites", "callSiteSymbols", "imports", "types", "constants"],

  collectGlobalFacts(project: ProjectIndex, context?: CrossFileAnalysisContext): UnusedExportFacts {
    return collectFacts(project, context);
  },

  finalizeGlobal(facts: unknown[]): Diagnostic[] {
    return finalize(facts as UnusedExportFacts[], this.severity);
  },

  analyze(project: ProjectIndex, context?: CrossFileAnalysisContext): Diagnostic[] {
    // Single-group view: the merge pipeline with exactly one group's facts.
    return finalize([collectFacts(project, context)], this.severity);
  },
};

interface ExportCandidate {
  file: string;
  name: string;
  /** Message wording only: "function" | "type" | "constant". */
  kindLabel: string;
  line: number;
  exportedAsDefault: boolean;
  /** Declaring class for methods — alive when the class is used anywhere. */
  className: string | null;
}

interface UnusedExportFacts {
  candidates: ExportCandidate[];
  /** `${file}\0${name}` keys proven used: resolved imports + bound call sites. */
  usedKeys: string[];
  wildcardImportedFiles: string[];
  defaultUsedFiles: string[];
}

function collectFacts(project: ProjectIndex, context: CrossFileAnalysisContext | undefined): UnusedExportFacts {
  // Declaration nodes referenced by call sites. Using valueDeclaration (the
  // AST node) instead of symbol identity so that inherited class methods are
  // correctly matched — a call to `subclass.method()` resolves through the
  // prototype chain to the same declaration node as the base class entry.
  const usedDeclarations = new Set<ts.Node>();
  const usedKeys = new Set<string>();
  // Files whose default export is referenced by some importer.
  const defaultUsedFiles = new Set<string>();
  const wildcardImportedFiles = new Set<string>();

  for (const site of project.callSites) {
    const symbol = site.symbol;
    if (symbol?.valueDeclaration === undefined) continue;
    usedDeclarations.add(symbol.valueDeclaration);
    // Cross-group reach: a sibling group's program may compile this file too,
    // so record the usage by (declaring file, symbol name) for the merge.
    usedKeys.add(exportKey(symbol.valueDeclaration.getSourceFile().fileName, symbol.name));
  }

  // Count source-resolved imports as usage. Default imports are tracked by
  // target file because the consumer may freely rename the local binding.
  // Namespace imports / star re-exports make every export of the target
  // reachable, so the whole file is exempted. The checker-resolved target
  // (path aliases, workspace packages) takes precedence; textual resolution
  // covers source-only mode where no program exists.
  const projectFiles = new Set(project.files.keys());
  for (const imp of project.imports) {
    const target = imp.resolvedFile ?? resolveImportTarget(imp.file, imp.source, projectFiles);
    if (target === null) continue;
    if (imp.importedName === "*") {
      wildcardImportedFiles.add(target);
    } else if (imp.importedName === "default") {
      defaultUsedFiles.add(target);
    } else {
      usedKeys.add(exportKey(target, imp.importedName));
    }
  }

  // Class names imported from other files. When a class is imported, its
  // public methods are reachable — callers may interact through an interface
  // type (DI, Effect layers) where the call-site symbol resolves to the
  // interface method, not the class method.
  const importedClassNames = buildImportedClassNames(project);

  // Per-file identifier occurrence counts. A declaration contributes one
  // occurrence of its own name; any second occurrence in the same file is a
  // same-file reference (value use, type annotation, callback, re-export
  // list). Shadowing can over-count, which only under-reports — safe.
  const identifierCounts = buildIdentifierCounts(project);
  const usedInOwnFile = (file: string, name: string): boolean =>
    (identifierCounts.get(file)?.get(name) ?? 0) > 1;

  const reportable = context?.reportableFiles;
  const candidates: ExportCandidate[] = [];

  for (const fn of project.functions.getAll()) {
    if (!fn.exported) continue;
    if (reportable !== undefined && !reportable.has(fn.file)) continue;
    if (isEntryPoint(fn.file)) continue;
    if (wildcardImportedFiles.has(fn.file)) continue;

    // Class methods on classes that implement an interface are contract
    // obligations — they exist to fulfill the interface, not as independent API
    if (fn.implementsInterface) continue;

    // Class methods on classes imported from other files are reachable
    // through the class instance, even when calls go through an interface type
    if (fn.className !== undefined && isClassImported(fn.className, fn.file, importedClassNames)) continue;

    // Declaration-based usage (handles inheritance)
    if (fn.symbol?.valueDeclaration && usedDeclarations.has(fn.symbol.valueDeclaration)) continue;

    if (usedKeys.has(exportKey(fn.file, fn.name))) continue;

    // Default-export reachability: if this function is the file's default
    // export and some importer's default import resolves to this file,
    // the function is in use even without a textual name match (consumers
    // can rename the binding: `import Whatever from "./file"`).
    if (fn.exportedAsDefault === true && defaultUsedFiles.has(fn.file)) continue;

    // Same-file reference without a call — passed as a callback, etc.
    if (usedInOwnFile(fn.file, fn.name)) continue;

    candidates.push({
      file: fn.file,
      name: fn.name,
      kindLabel: "function",
      line: fn.line,
      exportedAsDefault: fn.exportedAsDefault === true,
      className: fn.className ?? null,
    });
  }

  for (const type of project.types.getAll()) {
    if (!type.exported) continue;
    if (reportable !== undefined && !reportable.has(type.file)) continue;
    if (isEntryPoint(type.file)) continue;
    if (wildcardImportedFiles.has(type.file)) continue;
    if (usedKeys.has(exportKey(type.file, type.name))) continue;
    if (usedInOwnFile(type.file, type.name)) continue;

    candidates.push({
      file: type.file,
      name: type.name,
      kindLabel: "type",
      line: type.line,
      exportedAsDefault: false,
      className: null,
    });
  }

  for (const constant of project.constants.getAll()) {
    if (!constant.exported) continue;
    if (reportable !== undefined && !reportable.has(constant.file)) continue;
    if (isEntryPoint(constant.file)) continue;
    if (wildcardImportedFiles.has(constant.file)) continue;
    if (usedKeys.has(exportKey(constant.file, constant.name))) continue;
    if (usedInOwnFile(constant.file, constant.name)) continue;

    candidates.push({
      file: constant.file,
      name: constant.name,
      kindLabel: "constant",
      line: constant.line,
      exportedAsDefault: false,
      className: null,
    });
  }

  return {
    candidates,
    usedKeys: [...usedKeys],
    wildcardImportedFiles: [...wildcardImportedFiles],
    defaultUsedFiles: [...defaultUsedFiles],
  };
}

function finalize(factsList: UnusedExportFacts[], severity: Diagnostic["severity"]): Diagnostic[] {
  const used = new Set<string>();
  const wildcard = new Set<string>();
  const defaultUsed = new Set<string>();
  for (const facts of factsList) {
    for (const key of facts.usedKeys) used.add(key);
    for (const file of facts.wildcardImportedFiles) wildcard.add(file);
    for (const file of facts.defaultUsedFiles) defaultUsed.add(file);
  }

  const diagnostics: Diagnostic[] = [];
  const seen = new Set<string>();
  for (const facts of factsList) {
    for (const candidate of facts.candidates) {
      const key = exportKey(candidate.file, candidate.name);
      if (seen.has(key)) continue;
      seen.add(key);
      if (used.has(key)) continue;
      if (wildcard.has(candidate.file)) continue;
      if (candidate.exportedAsDefault && defaultUsed.has(candidate.file)) continue;
      if (candidate.className !== null && used.has(exportKey(candidate.file, candidate.className))) continue;

      diagnostics.push({
        ruleId: unusedExport.id,
        severity,
        message: `Exported ${candidate.kindLabel} "${candidate.name}" has no usages in the project`,
        file: candidate.file,
        line: candidate.line,
        column: 1,
      });
    }
  }
  return diagnostics;
}

/** Count identifier occurrences per file; the declaration itself counts once. */
function buildIdentifierCounts(project: ProjectIndex): Map<string, Map<string, number>> {
  const counts = new Map<string, Map<string, number>>();
  for (const [file, { sourceFile }] of project.files) {
    const fileCounts = new Map<string, number>();
    counts.set(file, fileCounts);
    const visit = (node: ts.Node): void => {
      if (ts.isIdentifier(node)) {
        fileCounts.set(node.text, (fileCounts.get(node.text) ?? 0) + 1);
      }
      ts.forEachChild(node, visit);
    };
    visit(sourceFile);
  }
  return counts;
}

function isEntryPoint(file: string): boolean {
  if (/\/index\.[cm]?[jt]sx?$/.test(file)) return true;
  return /\/bin\//.test(file);
}

/** Map each class name to the set of files that import it. */
function buildImportedClassNames(project: ProjectIndex): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  for (const imp of project.imports) {
    let files = map.get(imp.importedName);
    if (!files) {
      files = new Set();
      map.set(imp.importedName, files);
    }
    files.add(imp.file);
  }
  return map;
}

/** Check if a class is imported from a file other than where it's declared. */
function isClassImported(className: string, declFile: string, importedNames: Map<string, Set<string>>): boolean {
  const importers = importedNames.get(className);
  if (!importers) return false;
  return [...importers].some((f) => f !== declFile);
}

const MODULE_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"] as const;
const INDEX_BASENAMES = MODULE_EXTENSIONS.map((ext) => `index${ext}`);

function exportKey(file: string, name: string): string {
  return `${file}\0${name}`;
}

/**
 * Resolve a relative import source to a project file path. Returns null for
 * non-relative imports (package names) or when no candidate is in the project.
 */
function resolveImportTarget(
  importerFile: string,
  importSource: string,
  projectFiles: Set<string>,
): string | null {
  if (!importSource.startsWith(".")) return null;
  const base = path.resolve(path.dirname(importerFile), importSource);

  // Direct extension match (./foo -> ./foo.ts)
  for (const ext of MODULE_EXTENSIONS) {
    const candidate = base + ext;
    if (projectFiles.has(candidate)) return candidate;
  }
  // Already-extensioned (./foo.ts)
  if (projectFiles.has(base)) return base;
  // Directory with index file (./foo -> ./foo/index.ts)
  for (const idx of INDEX_BASENAMES) {
    const candidate = path.join(base, idx);
    if (projectFiles.has(candidate)) return candidate;
  }
  return null;
}
