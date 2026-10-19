interface Options {
  id: string;
  severity: string;
  message: string;
}
interface Fact { count: number; }
interface Graph { size: number; }
interface Context { enabled: boolean; }
declare function collect(graph: Graph, context: Context): Fact;
declare function finish(facts: readonly Fact[], severity: string): readonly string[];

export function createRule(options: Options) {
  return {
    id: options.id,
    severity: options.severity,
    message: options.message,
    collectGlobalFacts: collect,
    finalizeGlobal(facts: readonly Fact[]): readonly string[] {
      return finish(facts, this.severity);
    },
    analyze(graph: Graph, context: Context): readonly string[] {
      return finish([collect(graph, context)], this.severity);
    },
  };
}
