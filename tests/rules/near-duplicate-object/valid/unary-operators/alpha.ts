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
  finalizeGlobal(facts: readonly AlphaFact[]): readonly string[] {
    const direction = +facts.length;
    return finishAlpha(facts.slice(direction), this.severity);
  },
  analyze(graph: AlphaGraph, context: AlphaContext): readonly string[] {
    return finishAlpha([collectAlpha(graph, context)], this.severity);
  },
};
