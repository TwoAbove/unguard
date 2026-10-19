interface BetaFact { count: number; }
interface BetaGraph { size: number; }
interface BetaContext { enabled: boolean; }

declare function collectBeta(graph: BetaGraph, context: BetaContext): BetaFact;
declare function finishBeta(facts: readonly BetaFact[], severity: string): readonly string[];

export const betaRule = { // @expect near-duplicate-object
  id: "beta-rule",
  severity: "error",
  message: "Beta diagnostic",
  collectGlobalFacts: collectBeta,
  finalizeGlobal(facts: readonly BetaFact[]): readonly string[] {
    return finishBeta(facts, this.severity);
  },
  analyze(facts: BetaGraph, context: BetaContext): readonly string[] {
    return finishBeta([collectBeta(facts, context)], this.severity);
  },
};
