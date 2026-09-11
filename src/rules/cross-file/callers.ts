import type { CallFact, Graph, NodeId, ParamFact, Site } from "../../graph/types.ts";
import type { CrossFileAnalysisContext } from "../types.ts";

export interface FunctionCandidate {
  id: NodeId;
  site: Site;
  params: ParamFact[];
}

export type CallEvidence = Pick<CallFact, "id" | "callee" | "args" | "resolvedSignature">;

export interface CallerFacts {
  calls: CallEvidence[];
  signatureConstraints: NodeId[];
}

export interface FunctionCallerFacts extends CallerFacts {
  candidates: FunctionCandidate[];
}

export function collectCallerFacts(graph: Graph): CallerFacts {
  // A sibling project can contribute calls and contracts for declarations it does not own.
  return {
    calls: graph.calls().map(({ id, callee, args, resolvedSignature }) => ({
      id, callee, args, resolvedSignature,
    })),
    signatureConstraints: [...graph.signatureConstraints()],
  };
}

export function collectFunctionCallerFacts(
  graph: Graph,
  context: CrossFileAnalysisContext | undefined,
): FunctionCallerFacts {
  const candidates: FunctionCandidate[] = [];
  for (const fn of graph.functions()) {
    if (context?.reportableFiles !== undefined && !context.reportableFiles.has(fn.site.file)) continue;
    if (fn.params.some((param) => param.isRest)) continue;
    candidates.push({ id: fn.id, site: fn.site, params: fn.params });
  }
  return { candidates, ...collectCallerFacts(graph) };
}

export function* mergeCallerFacts<T extends { id: NodeId }>(
  factsList: readonly (CallerFacts & { candidates: readonly T[] })[],
) {
  const callers = new Map<NodeId, {
    observations: CallEvidence[];
    sites: Set<NodeId>;
    hasSpread: boolean;
  }>();
  const signatureConstraints = new Set<NodeId>();
  for (const facts of factsList) {
    for (const id of facts.signatureConstraints) signatureConstraints.add(id);
    for (const call of facts.calls) {
      if (call.callee === null) continue;
      let evidence = callers.get(call.callee);
      if (evidence === undefined) {
        evidence = { observations: [], sites: new Set(), hasSpread: false };
        callers.set(call.callee, evidence);
      }
      // Count overlapping sites once, retaining conflicting checker observations.
      evidence.observations.push(call);
      evidence.sites.add(call.id);
      if (call.args.some((arg) => arg.kind === "spread")) evidence.hasSpread = true;
    }
  }
  const seen = new Set<NodeId>();
  for (const facts of factsList) {
    for (const candidate of facts.candidates) {
      if (seen.has(candidate.id) || signatureConstraints.has(candidate.id)) continue;
      seen.add(candidate.id);
      const evidence = callers.get(candidate.id);
      if (evidence !== undefined) yield { candidate, evidence };
    }
  }
}
