import type { CrossFileRule, Diagnostic } from "../types.ts";
import { collectFunctionCallerFacts, mergeCallerFacts, type FunctionCallerFacts } from "./callers.ts";

/**
 * The mirror of `optional-arg-always-used`: an optional (or defaulted)
 * parameter that no call site ever provides is speculative API surface —
 * remove it and inline its default into the body.
 */
export const optionalArgNeverUsed: CrossFileRule = {
  id: "optional-arg-never-used",
  severity: "warning",
  message: "Optional parameter is never provided at any call site; remove it",

  collectGlobalFacts: collectFunctionCallerFacts,

  finalizeGlobal(facts: unknown[]): Diagnostic[] {
    return finalize(facts as FunctionCallerFacts[], this.severity);
  },

  analyze(graph, context): Diagnostic[] {
    return finalize([collectFunctionCallerFacts(graph, context)], this.severity);
  },
};

function finalize(factsList: FunctionCallerFacts[], severity: Diagnostic["severity"]): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  for (const { candidate: fn, evidence } of mergeCallerFacts(factsList)) {
    if (evidence.sites.size < 2 || evidence.hasSpread) continue;
    const neverProvided: string[] = [];
    for (let i = 0; i < fn.params.length; i++) {
      const param = fn.params[i];
      if (param === undefined || (!param.optional && !param.hasDefault)) continue;
      if (evidence.observations.every((call) => call.args.length <= i)) neverProvided.push(param.name);
    }
    if (neverProvided.length === 0) continue;

    const names = neverProvided.map((name) => `"${name}"`).join(", ");
    diagnostics.push({
      ruleId: optionalArgNeverUsed.id,
      severity,
      message: `Optional parameter${neverProvided.length > 1 ? "s" : ""} ${names} ${neverProvided.length > 1 ? "are" : "is"} never provided at any of the ${evidence.sites.size} call sites; remove ${neverProvided.length > 1 ? "them" : "it"} and inline the default`,
      file: fn.site.file,
      line: fn.site.line,
      column: fn.site.column,
    });
  }
  return diagnostics;
}
