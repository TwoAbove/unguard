export interface Fact { count: number; }
export interface Graph { size: number; }
export interface Context { enabled: boolean; }
export declare function collect(graph: Graph, context: Context): Fact;
export declare function finish(facts: readonly Fact[], severity: string): readonly string[];
