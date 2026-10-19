import type { Graph, NodeId } from "../../graph/types.ts";
import type { CrossFileAnalysisContext } from "../types.ts";
import { callerRule, collectVisibleCallerFacts, mergeVisibleCallerFacts, type VisibleCallerFacts } from "./callers.ts";

interface NullableParamFacts extends VisibleCallerFacts {
  nullableParameters: NodeId[];
}

export const nullableParamNeverNull = callerRule({
  id: "nullable-param-never-null",
  message: "Parameter type admits null or undefined, but no call site passes either; narrow the type",

  collect(graph: Graph, context?: CrossFileAnalysisContext): NullableParamFacts {
    const facts = collectVisibleCallerFacts(graph, context);
    const nullable = graph.nullableParameters();
    // An overload implementation widens its parameters to cover every overload.
    const candidates = facts.candidates.filter((fn) => graph.overloads(fn.id).length <= 1);
    return {
      ...facts,
      candidates,
      nullableParameters: candidates.flatMap((fn) => fn.params.filter((param) => nullable.has(param.id)).map((param) => param.id)),
    };
  },

  *judge(factsList: NullableParamFacts[]) {
    const nullable = new Set(factsList.flatMap((facts) => facts.nullableParameters));
    for (const { candidate: fn, evidence } of mergeVisibleCallerFacts(factsList)) {
      if (evidence.hasSpread) continue;
      for (const [i, param] of fn.params.entries()) {
        if (param.optional || param.hasDefault || !nullable.has(param.id)) continue;
        if (!evidence.observations.every((call) => call.nullableArgs[i] === false)) continue;
        const sites = evidence.sites.size === 1 ? "its only call site passes neither" : `none of its ${evidence.sites.size} call sites passes either`;
        yield { site: fn.site, message: `Parameter "${param.name}" admits null or undefined, but ${sites}; drop them from its type` };
      }
    }
  },
});
