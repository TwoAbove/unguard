import type { Graph, OverloadFamilyFact } from "../../graph/types.ts";
import type { CrossFileAnalysisContext } from "../types.ts";
import { callerRule, collectCallerFacts, mergeCallerFacts, type CallerFacts } from "./callers.ts";

interface OverloadFacts extends CallerFacts {
  candidates: OverloadFamilyFact[];
}

export const deadOverload = callerRule({
  id: "dead-overload",
  message: "Overload signature has no matching call sites in the project",

  collect(graph: Graph, context?: CrossFileAnalysisContext): OverloadFacts {
    const candidates: OverloadFamilyFact[] = [];
    for (const family of graph.overloadFamilies()) {
      const implementation = family.signatures.at(-1);
      if (implementation === undefined) continue;
      if (context?.reportableFiles !== undefined && !context.reportableFiles.has(implementation.site.file)) continue;
      candidates.push(family);
    }
    return { candidates, ...collectCallerFacts(graph) };
  },

  *judge(factsList: OverloadFacts[]) {
    for (const { candidate: family, evidence } of mergeCallerFacts(factsList)) {
      const { signatures } = family;
      if (signatures.length < 2) continue;

      const implementationIndex = signatures.length - 1;
      if (!signatures[implementationIndex]?.hasBody) continue;
      if (signatures.slice(0, implementationIndex).some((signature) => signature.hasBody)) continue;

      const matched = new Set(
        evidence.observations.flatMap((call) =>
          call.resolvedSignature === null ? [] : [call.resolvedSignature]
        ),
      );
      if (matched.size === 0) continue;

      for (const signature of signatures.slice(0, implementationIndex)) {
        if (matched.has(signature.id)) continue;
        yield { site: signature.site, message: `Overload signature for "${family.name}" has no matching call sites in the project` };
      }
    }
  },
});
