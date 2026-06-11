import type { CrossFileRule, Diagnostic, ProjectIndex } from "../types.ts";
import { optionalParams, signatureChangeCallSites } from "./call-site-utils.ts";

export const optionalArgAlwaysUsed: CrossFileRule = {
  id: "optional-arg-always-used",
  severity: "warning",
  message: "Optional parameter is always provided at every call site; make it required",
  requires: ["functions", "functionSymbols", "callSites", "callSiteSymbols"],

  analyze(project: ProjectIndex): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];

    for (const fn of project.functions.getAll()) {
      const callSites = signatureChangeCallSites(fn, project, 2);
      if (callSites === null) continue;

      for (const { index, param } of optionalParams(fn)) {
        // Check if every call site provides this positional argument
        if (!callSites.every((c) => c.argCount > index)) continue;
        diagnostics.push({
          ruleId: this.id,
          severity: this.severity,
          message: `Optional parameter "${param.name}" is always provided at all ${callSites.length} call sites; make it required`,
          file: fn.file,
          line: fn.line,
          column: 1,
        });
      }
    }

    return diagnostics;
  },
};
