import type { Graph } from "../../graph/types.ts";
import type { CrossFileAnalysisContext, CrossFileRule, Diagnostic } from "../types.ts";
import { collectFunctionCallerFacts, mergeCallerFacts, type FunctionCallerFacts } from "./callers.ts";

/**
 * A parameter that receives the identical literal at every call site is not
 * really a parameter — the "choice" it offers is never exercised. Inline the
 * value and fold any branching on it.
 */
export const constantArgument: CrossFileRule = {
  id: "constant-argument",
  severity: "warning",
  message: "Parameter receives the same literal at every call site; inline the value",

  collectGlobalFacts(graph: Graph, context?: CrossFileAnalysisContext): FunctionCallerFacts {
    return collectFunctionCallerFacts(graph, context);
  },

  finalizeGlobal(facts: unknown[]): Diagnostic[] {
    return finalize(facts as FunctionCallerFacts[], this.severity);
  },

  analyze(graph: Graph, context?: CrossFileAnalysisContext): Diagnostic[] {
    return finalize([collectFunctionCallerFacts(graph, context)], this.severity);
  },
};

function finalize(factsList: FunctionCallerFacts[], severity: Diagnostic["severity"]): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  for (const { candidate, evidence } of mergeCallerFacts(factsList)) {
    if (evidence.sites.size < 3 || evidence.hasSpread) continue;
    for (const [i, { name }] of candidate.params.entries()) {
      const first = evidence.observations[0]?.args[i];
      if (first?.kind !== "literal") continue;
      const firstText = first.text;
      if (
        !evidence.observations.every((call) => {
          const arg = call.args[i];
          return arg?.kind === "literal" && arg.text === firstText;
        })
      ) {
        continue;
      }

      diagnostics.push({
        ruleId: constantArgument.id,
        severity,
        message: `Parameter "${name}" receives ${firstText} at all ${evidence.sites.size} call sites; inline the value and remove the parameter`,
        file: candidate.site.file,
        line: candidate.site.line,
        column: candidate.site.column,
      });
    }
  }
  return diagnostics;
}

