import type { CallFact, Graph, NodeId, ParamFact, ResultUse, Site } from "../../graph/types.ts";
import { type CrossFileAnalysisContext, type CrossFileRule, type Diagnostic, diagnosticAtSite } from "../types.ts";

export interface Finding {
  site: Site;
  message: string;
}

export function callerRule<F>(spec: {
  id: string;
  message: string;
  collect(graph: Graph, context?: CrossFileAnalysisContext): F;
  judge(factsList: F[]): Iterable<Finding>;
}): CrossFileRule {
  return {
    id: spec.id,
    severity: "warning",
    message: spec.message,
    collectGlobalFacts: spec.collect,
    finalizeGlobal(facts: unknown[]): Diagnostic[] {
      return report(this, spec.judge(facts as F[]));
    },
    analyze(graph, context): Diagnostic[] {
      return report(this, spec.judge([spec.collect(graph, context)]));
    },
  };
}

function report(rule: CrossFileRule, findings: Iterable<Finding>): Diagnostic[] {
  return Array.from(findings, ({ site, message }) => diagnosticAtSite(rule, site, message));
}

export interface FunctionCandidate {
  id: NodeId;
  site: Site;
  params: ParamFact[];
}

export type CallEvidence = Pick<CallFact, "id" | "callee" | "args" | "resolvedSignature" | "nullableArgs" | "resultUse">;

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
    calls: graph.calls().map(({ id, callee, args, resolvedSignature, nullableArgs, resultUse }) => ({
      id, callee, args, resolvedSignature, nullableArgs, resultUse,
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

export interface VisibleCallerFacts extends FunctionCallerFacts {
  valueReferenced: NodeId[];
}

export function collectVisibleCallerFacts(
  graph: Graph,
  context: CrossFileAnalysisContext | undefined,
): VisibleCallerFacts {
  return { ...collectFunctionCallerFacts(graph, context), valueReferenced: [...graph.valueReferencedFunctions()] };
}

export function* mergeVisibleCallerFacts(factsList: readonly VisibleCallerFacts[]) {
  const referenced = new Set(factsList.flatMap((facts) => facts.valueReferenced));
  for (const entry of mergeCallerFacts(factsList)) {
    if (!referenced.has(entry.candidate.id)) yield entry;
  }
}

export function everyCallSite(use: ResultUse, describe: (sites: number) => string) {
  return function* judge(factsList: VisibleCallerFacts[]): Iterable<Finding> {
    for (const { candidate, evidence } of mergeVisibleCallerFacts(factsList)) {
      if (evidence.sites.size >= 2 && evidence.observations.every((call) => call.resultUse === use)) {
        yield { site: candidate.site, message: describe(evidence.sites.size) };
      }
    }
  };
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
