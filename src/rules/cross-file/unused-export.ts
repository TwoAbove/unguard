import type * as ts from "typescript";
import type { CrossFileRule, Diagnostic, ProjectIndex } from "../types.ts";

export const unusedExport: CrossFileRule = {
  id: "unused-export",
  severity: "info",
  message: "Exported function has no usages within the project",
  requires: ["functions", "functionSymbols", "callSites", "callSiteSymbols", "imports"],

  analyze(project: ProjectIndex): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];

    // Build set of declaration nodes referenced by call sites.
    // Using valueDeclaration (the AST node) instead of symbol identity
    // so that inherited class methods are correctly matched — a call to
    // `subclass.method()` resolves through the prototype chain to the
    // same declaration node as the base class method entry.
    const usedDeclarations = new Set<ts.Node>();
    const usedNamesByFile = new Map<string, Set<string>>();

    for (const site of project.callSites) {
      if (site.symbol?.valueDeclaration) {
        usedDeclarations.add(site.symbol.valueDeclaration);
      }
      let files = usedNamesByFile.get(site.calleeName);
      if (!files) {
        files = new Set();
        usedNamesByFile.set(site.calleeName, files);
      }
      files.add(site.file);
    }

    // Also count imports as usage
    for (const imp of project.imports) {
      let files = usedNamesByFile.get(imp.importedName);
      if (!files) {
        files = new Set();
        usedNamesByFile.set(imp.importedName, files);
      }
      files.add(imp.file);
    }

    // Build set of class names that are imported from other files.
    // When a class is imported, its public methods are reachable — callers
    // may interact through an interface type (DI, Effect layers) where the
    // call-site symbol resolves to the interface method, not the class method.
    const importedClassNames = buildImportedClassNames(project);

    for (const fn of project.functions.getAll()) {
      if (!fn.exported) continue;
      if (isEntryPoint(fn.file)) continue;

      // Class methods on classes that implement an interface are contract
      // obligations — they exist to fulfill the interface, not as independent API
      if (fn.implementsInterface) continue;

      // Class methods on classes imported from other files are reachable
      // through the class instance, even when calls go through an interface type
      if (fn.className && isClassImported(fn.className, fn.file, importedClassNames)) continue;

      // Check declaration-based usage (handles inheritance)
      if (fn.symbol?.valueDeclaration && usedDeclarations.has(fn.symbol.valueDeclaration)) continue;

      // Fallback: check name-based usage from OTHER files
      const nameUsers = usedNamesByFile.get(fn.name);
      if (nameUsers) {
        const hasExternalUser = [...nameUsers].some((f) => f !== fn.file);
        if (hasExternalUser) continue;
      }

      diagnostics.push({
        ruleId: this.id,
        severity: this.severity,
        message: `Exported function "${fn.name}" has no usages in the project`,
        file: fn.file,
        line: fn.line,
        column: 1,
      });
    }
    return diagnostics;
  },
};

function isEntryPoint(file: string): boolean {
  if (/\/index\.[cm]?[jt]sx?$/.test(file)) return true;
  if (/\/bin\//.test(file)) return true;
  return false;
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
