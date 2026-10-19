interface AlphaFact { count: number; }
interface AlphaGraph { size: number; }
interface AlphaContext { enabled: boolean; }

declare function collectAlpha(graph: AlphaGraph, context: AlphaContext): AlphaFact;
declare function finishAlpha(facts: readonly AlphaFact[], severity: string): readonly string[];

export const alphaRule = {
  id: "alpha-rule",
  severity: "warning",
  message: "Alpha diagnostic",
  collectGlobalFacts: collectAlpha,
  finalizeGlobal: (facts: readonly AlphaFact[]): readonly string[] => {
    return finishAlpha(facts, "warning");
  },
  get analyze() {
    return (graph: AlphaGraph, context: AlphaContext): readonly string[] =>
      finishAlpha([collectAlpha(graph, context)], "warning");
  },
};
