import { type Fact as BetaFact, type Graph as BetaGraph, type Context as BetaContext, collect as collectBeta, finish as finishBeta } from "./shared.ts";

export const betaRule = {
  id: "shared-rule",
  severity: "warning",
  message: "Shared diagnostic",
  collectGlobalFacts: collectBeta,
  finalizeGlobal(facts: readonly BetaFact[]): readonly string[] {
    return finishBeta(facts, this.severity);
  },
  analyze(graph: BetaGraph, context: BetaContext): readonly string[] {
    return finishBeta([collectBeta(graph, context)], this.severity);
  },
};
