import { type Fact as AlphaFact, type Graph as AlphaGraph, type Context as AlphaContext, collect as collectAlpha, finish as finishAlpha } from "./shared.ts";

export const alphaRule = {
  id: "shared-rule",
  severity: "warning",
  message: "Shared diagnostic",
  collectGlobalFacts: collectAlpha,
  finalizeGlobal(facts: readonly AlphaFact[]): readonly string[] {
    return finishAlpha(facts, this.severity);
  },
  analyze(graph: AlphaGraph, context: AlphaContext): readonly string[] {
    return finishAlpha([collectAlpha(graph, context)], this.severity);
  },
};
