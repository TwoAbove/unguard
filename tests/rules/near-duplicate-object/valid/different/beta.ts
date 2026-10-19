interface BetaFact { count: number; }
interface BetaGraph { size: number; }
interface BetaContext { enabled: boolean; }

declare function collectBeta(graph: BetaGraph, context: BetaContext): BetaFact;
declare function finishBeta(facts: readonly BetaFact[], severity: string): readonly string[];

export const betaRule = {
  id: "beta-rule",
  severity: "error",
  message: "Beta diagnostic",
  collectGlobalFacts: collectBeta,
  finalizeGlobal(facts: readonly BetaFact[]): readonly string[] {
    return finishBeta(facts, this.severity);
  },
  analyze(graph: BetaGraph, context: BetaContext): readonly string[] {
    return finishBeta([collectBeta(graph, context)], this.severity).filter((message) => message.length > 0);
  },
};
