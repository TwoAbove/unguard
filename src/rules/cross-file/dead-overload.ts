import type { Graph, OverloadFamilyFact } from "../../graph/types.ts";
import type { CrossFileAnalysisContext, CrossFileRule, Diagnostic } from "../types.ts";
import { collectCallerFacts, mergeCallerFacts, type CallerFacts } from "./callers.ts";

export const deadOverload: CrossFileRule = {
  id: "dead-overload",
  severity: "warning",
  message: "Overload signature has no matching call sites in the project",

  collectGlobalFacts: collectFacts,

  finalizeGlobal(facts: unknown[]): Diagnostic[] {
    return finalize(facts as OverloadFacts[], this.severity);
  },

  analyze(graph, context): Diagnostic[] {
    return finalize([collectFacts(graph, context)], this.severity);
  },
};

interface OverloadFacts extends CallerFacts {
  candidates: OverloadFamilyFact[];
}

function collectFacts(graph: Graph, context?: CrossFileAnalysisContext): OverloadFacts {
  const candidates: OverloadFamilyFact[] = [];
  for (const family of graph.overloadFamilies()) {
    const implementation = family.signatures.at(-1);
    if (implementation === undefined) continue;
    if (context?.reportableFiles !== undefined && !context.reportableFiles.has(implementation.site.file)) continue;
    candidates.push(family);
  }
  return { candidates, ...collectCallerFacts(graph) };
}

function finalize(factsList: OverloadFacts[], severity: Diagnostic["severity"]): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
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

    for (let index = 0; index < implementationIndex; index++) {
      const signature = signatures[index];
      if (signature === undefined || matched.has(signature.id)) continue;
      diagnostics.push({
        ruleId: deadOverload.id,
        severity,
        message: `Overload signature for "${family.name}" has no matching call sites in the project`,
        file: signature.site.file,
        line: signature.site.line,
        column: signature.site.column,
      });
    }
  }
  return diagnostics;
}
