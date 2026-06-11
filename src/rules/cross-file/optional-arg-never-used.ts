import type { CrossFileRule, Diagnostic, ProjectIndex } from "../types.ts";
import { optionalParams, signatureChangeCallSites } from "./call-site-utils.ts";

/**
 * The mirror of `optional-arg-always-used`: an optional (or defaulted)
 * parameter that no call site ever provides is speculative API surface —
 * remove it and inline its default into the body.
 */
export const optionalArgNeverUsed: CrossFileRule = {
  id: "optional-arg-never-used",
  severity: "warning",
  message: "Optional parameter is never provided at any call site; remove it",
  requires: ["functions", "functionSymbols", "callSites", "callSiteSymbols"],

  analyze(project: ProjectIndex): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];

    for (const fn of project.functions.getAll()) {
      const callSites = signatureChangeCallSites(fn, project, 2);
      if (callSites === null) continue;

      const neverProvided: string[] = [];
      for (const { index, param } of optionalParams(fn)) {
        if (callSites.every((c) => c.argCount <= index)) {
          neverProvided.push(param.name);
        }
      }
      if (neverProvided.length === 0) continue;

      const names = neverProvided.map((n) => `"${n}"`).join(", ");
      diagnostics.push({
        ruleId: this.id,
        severity: this.severity,
        message: `Optional parameter${neverProvided.length > 1 ? "s" : ""} ${names} ${neverProvided.length > 1 ? "are" : "is"} never provided at any of the ${callSites.length} call sites; remove ${neverProvided.length > 1 ? "them" : "it"} and inline the default`,
        file: fn.file,
        line: fn.line,
        column: 1,
      });
    }

    return diagnostics;
  },
};
