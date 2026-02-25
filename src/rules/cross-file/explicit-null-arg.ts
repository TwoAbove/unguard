import * as ts from "typescript";
import type { CrossFileRule, Diagnostic, ProjectIndex } from "../types.ts";
import { isNullishLiteral } from "../../typecheck/utils.ts";

export const explicitNullArg: CrossFileRule = {
  id: "explicit-null-arg",
  severity: "warning",
  message: "Explicit null/undefined passed to a project function; consider redesigning the interface to not accept nullish values",

  analyze(project: ProjectIndex): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];

    // Build lookup structures for known project functions
    const projectFnNames = new Set<string>();
    const projectFnSymbols = new Set<ts.Symbol>();
    for (const fn of project.functions.getAll()) {
      projectFnNames.add(fn.name);
      if (fn.symbol) projectFnSymbols.add(fn.symbol);
    }

    for (const site of project.callSites) {
      // Only flag calls to functions defined in the project — prefer symbol matching
      const isProjectFn = site.symbol
        ? projectFnSymbols.has(site.symbol)
        : projectFnNames.has(site.calleeName);
      if (!isProjectFn) continue;

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

