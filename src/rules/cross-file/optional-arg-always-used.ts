import type { CrossFileRule, Diagnostic } from "../types.ts";
import { collectFunctionCallerFacts, mergeCallerFacts, type FunctionCallerFacts } from "./callers.ts";

export const optionalArgAlwaysUsed: CrossFileRule = {
  id: "optional-arg-always-used",
  severity: "warning",
  message: "Optional parameter is always provided at every call site; make it required",

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
    for (let i = 0; i < fn.params.length; i++) {
      const param = fn.params[i];
      if (param === undefined || (!param.optional && !param.hasDefault)) continue;
      if (!evidence.observations.every((call) => call.args.length > i)) continue;
      diagnostics.push({
        ruleId: optionalArgAlwaysUsed.id,
        severity,
        message: `Optional parameter "${param.name}" is always provided at all ${evidence.sites.size} call sites; make it required`,
        file: fn.site.file,
        line: fn.site.line,
        column: fn.site.column,
      });
    }
  }
  return diagnostics;
}
