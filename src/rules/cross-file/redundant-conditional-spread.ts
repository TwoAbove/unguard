import type { CrossFileAnalysisContext, CrossFileRule, Diagnostic, ProjectIndex } from "../types.ts";
import type { PresenceIndex, PresenceSite } from "../../collect/presence.ts";

/**
 * `...(x === undefined ? {} : { x })` distinguishes an absent key from an
 * explicit `undefined` — a distinction only key-presence observers can see.
 * The presence collector excludes compiler-forced and merge-protecting sites
 * up front and records every observer and type flow in the project; this rule
 * fires a site only when no observation of the target key is reachable from
 * the target type. A finding is therefore a certificate: nothing in the
 * project can tell the two spellings apart, so write the property directly.
 *
 * Conservative by construction — external calls, `any`, JSX, and rest
 * patterns count as observers. Global hooks merge facts across tsconfig
 * groups so a monorepo observer in another group still silences a site.
 */
export const redundantConditionalSpread: CrossFileRule = {
  id: "redundant-conditional-spread",
  severity: "warning",
  message: "conditional spread guards key presence that nothing in the project observes; write the property directly",
  requires: ["presence"],

  collectGlobalFacts(project: ProjectIndex, context?: CrossFileAnalysisContext): PresenceFacts {
    return extractFacts(project.presence, context);
  },

  finalizeGlobal(facts: unknown[]): Diagnostic[] {
    return finalize(facts as PresenceFacts[], this.severity);
  },

  analyze(project: ProjectIndex, context?: CrossFileAnalysisContext): Diagnostic[] {
    // Single-group view: the merge pipeline with exactly one group's facts.
    return finalize([extractFacts(project.presence, context)], this.severity);
  },
};

interface SiteFact extends PresenceSite {
  reportable: boolean;
}

/** structuredClone-safe projection of one group's presence index. */
interface PresenceFacts {
  sites: SiteFact[];
  /** typeId -> keys observed on it ("*" = all keys) */
  observed: [string, string[]][];
  /** typeId -> typeIds its values flow into */
  edges: [string, string[]][];
}

function extractFacts(presence: PresenceIndex, context?: CrossFileAnalysisContext): PresenceFacts {
  let reportableFiles: ReadonlySet<string> | undefined;
  if (context !== undefined) reportableFiles = context.reportableFiles;
  return {
    sites: presence.sites.map((site) => ({
      ...site,
      reportable: reportableFiles === undefined || reportableFiles.has(site.file),
    })),
    observed: [...presence.observed].map(([id, keys]) => [id, [...keys]]),
    edges: [...presence.edges].map(([id, targets]) => [id, [...targets]]),
  };
}

function finalize(factsList: PresenceFacts[], severity: Diagnostic["severity"]): Diagnostic[] {
  const observed = new Map<string, Set<string>>();
  const edges = new Map<string, Set<string>>();
  for (const facts of factsList) {
    for (const [id, keys] of facts.observed) {
      mergeInto(observed, id, keys);
    }
    for (const [id, targets] of facts.edges) {
      mergeInto(edges, id, targets);
    }
  }

  const diagnostics: Diagnostic[] = [];
  for (const facts of factsList) {
    for (const site of facts.sites) {
      if (!site.reportable) continue;
      if (keyObservationReachable(site, observed, edges)) continue;
      diagnostics.push({
        ruleId: "redundant-conditional-spread",
        severity,
        message: `conditional spread guards whether \`${site.key}\` exists on \`${site.typeName}\`, but no code in the project observes that key's presence; write \`${site.key}\` directly`,
        file: site.file,
        line: site.line,
        column: site.column,
      });
    }
  }
  return diagnostics;
}

function mergeInto(map: Map<string, Set<string>>, id: string, values: string[]): void {
  const existing = map.get(id);
  if (existing === undefined) {
    map.set(id, new Set(values));
    return;
  }
  for (const value of values) existing.add(value);
}

/** BFS the flow graph from the site's target type looking for an observation of its key. */
function keyObservationReachable(
  site: SiteFact,
  observed: Map<string, Set<string>>,
  edges: Map<string, Set<string>>,
): boolean {
  const visited = new Set<string>(site.typeIds);
  const queue = [...site.typeIds];
  while (queue.length > 0) {
    const id = queue.pop();
    if (id === undefined) break;
    const keys = observed.get(id);
    if (keys !== undefined && (keys.has("*") || keys.has(site.key))) return true;
    const targets = edges.get(id);
    if (targets === undefined) continue;
    for (const target of targets) {
      if (visited.has(target)) continue;
      visited.add(target);
      queue.push(target);
    }
  }
  return false;
}
