import * as ts from "typescript";
import type { CrossFileRule, Diagnostic, ProjectIndex } from "../types.ts";
import { isNullishLiteral } from "../../typecheck/utils.ts";

export const explicitNullArg: CrossFileRule = {
  id: "explicit-null-arg",
  severity: "warning",
  message: "Explicit null/undefined passed to a project function; consider redesigning the interface to not accept nullish values",
  requires: ["functions", "functionSymbols", "callSites", "callSiteSymbols"],

  analyze(project: ProjectIndex): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];

    // Build lookup structures for known project functions
    const projectFnSymbols = new Set<ts.Symbol>();
    for (const fn of project.functions.getAll()) {
      if (fn.symbol) projectFnSymbols.add(fn.symbol);
    }

    for (const site of project.callSites) {
      // Only flag calls that resolve, by symbol, to a project function.
      // A name fallback would misfire on unrelated same-named callees.
      if (site.symbol === undefined || !projectFnSymbols.has(site.symbol)) continue;

      for (let i = 0; i < site.node.arguments.length; i++) {
        const arg = site.node.arguments[i];
        if (arg === undefined) continue;
        if (isNullishLiteral(arg)) {
          const val = arg.kind === ts.SyntaxKind.NullKeyword ? "null" : "undefined";
          diagnostics.push({
            ruleId: this.id,
            severity: this.severity,
            message: `Passing explicit ${val} to "${site.calleeName}" at argument ${i + 1}; consider redesigning the interface to not accept nullish values`,
            file: site.file,
            line: site.line,
            column: 1,
          });
          break; // one diagnostic per call site
        }
      }
    }

    return diagnostics;
  },
};
