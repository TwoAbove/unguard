import { parentPort } from "node:worker_threads";
import { allRules } from "../rules/index.ts";
import { isTSRule, type CrossFileRule, type ProjectIndexNeed, type Rule } from "../rules/types.ts";
import { analyzeGroup } from "./analyze.ts";
import type { WorkerRequest, WorkerResponse, RuleSpec } from "./worker-pool.ts";

if (parentPort === null) {
  throw new Error("unguard worker entry must run in a worker_threads context");
}

const port = parentPort;
const ruleById = new Map<string, Rule>(allRules.map((rule) => [rule.id, rule]));

port.on("message", (req: WorkerRequest) => {
  try {
    const rules = resolveRules(req.ruleSpecs);
    const tsRules = rules.filter(isTSRule);
    const crossFileRules = rules.filter((r): r is CrossFileRule => !isTSRule(r));
    const indexNeeds: ReadonlySet<ProjectIndexNeed> = new Set(req.indexNeeds);
    const diagnostics = analyzeGroup(req.groupConfig, tsRules, crossFileRules, indexNeeds);
    const response: WorkerResponse = { taskId: req.taskId, ok: true, diagnostics };
    port.postMessage(response);
  } catch (err) {
    // @unguard no-swallowed-catch worker boundary: forwarded as a structured response to the parent thread.
    const message = err instanceof Error ? `${err.message}\n${err.stack ?? ""}` : String(err);
    const response: WorkerResponse = { taskId: req.taskId, ok: false, error: message };
    port.postMessage(response);
  }
});

function resolveRules(specs: RuleSpec[]): Rule[] {
  const rules: Rule[] = [];
  for (const spec of specs) {
    const rule = ruleById.get(spec.id);
    if (rule === undefined) continue;
    if (spec.severity === "off") continue;
    if (rule.severity === spec.severity) {
      rules.push(rule);
      continue;
    }
    rules.push({ ...rule, severity: spec.severity });
  }
  return rules;
}
