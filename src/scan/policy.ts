import { relative } from "node:path";
import ignore from "ignore";
import type { Diagnostic, Rule } from "../rules/types.ts";
import { getRuleMetadata } from "../rules/index.ts";
import { applyBaseline } from "./baseline.ts";
import type {
  ResolvedRuleOverride,
  ResolvedScanConfig,
  RuleDescriptor,
  RulePolicySeverity,
  ScanExecutionResult,
  ScanResult,
  Severity,
} from "./types.ts";

export function buildRuleDescriptors(rules: Rule[]): RuleDescriptor[] {
  return rules.map((rule) => {
    const metadata = getRuleMetadata(rule.id);
    return {
      rule,
      category: metadata.category,
      tags: metadata.tags,
      confidence: metadata.confidence,
    };
  });
}

export function resolveActiveRules(
  descriptors: RuleDescriptor[],
  config: ResolvedScanConfig,
): Rule[] {
  const selectedRules = config.rules ? new Set(config.rules) : null;
  const wantedConfidence = config.mode === "audit" ? "heuristic" : "proven";
  const active: Rule[] = [];

  for (const descriptor of descriptors) {
    if (selectedRules) {
      // An explicit rule filter names what to run; the mode split is moot.
      if (!selectedRules.has(descriptor.rule.id)) continue;
    } else if (descriptor.confidence !== wantedConfidence) {
      continue;
    }
    const resolvedSeverity = resolveRuleSeverity(descriptor, config);
    if (resolvedSeverity === "off") continue;
    if (descriptor.rule.severity === resolvedSeverity) {
      active.push(descriptor.rule);
      continue;
    }
    active.push({ ...descriptor.rule, severity: resolvedSeverity });
  }

  return active;
}

function resolveRuleSeverity(descriptor: RuleDescriptor, config: ResolvedScanConfig): RulePolicySeverity {
  let severity: RulePolicySeverity = descriptor.rule.severity;
  for (const entry of config.rulePolicy) {
    if (!matchesSelector(descriptor, entry.selector)) continue;
    severity = entry.severity;
  }

  if (severity === "off") return "off";
  if (config.strict) return "error";
  return severity;
}

function matchesSelector(
  descriptor: Pick<RuleDescriptor, "category" | "tags" | "confidence"> & { rule: { id: string } },
  selector: string,
): boolean {
  if (selector.startsWith("category:")) {
    return descriptor.category === selector.slice("category:".length);
  }
  if (selector.startsWith("tag:")) {
    return descriptor.tags.includes(selector.slice("tag:".length));
  }
  if (selector.startsWith("confidence:")) {
    return descriptor.confidence === selector.slice("confidence:".length);
  }
  if (selector === descriptor.rule.id) return true;
  if (!selector.includes("*")) return false;
  const regex = new RegExp(`^${escapeRegex(selector).replaceAll("\\*", ".*")}$`);
  return regex.test(descriptor.rule.id);
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function finalizeScanResult(
  diagnostics: Diagnostic[],
  fileCount: number,
  config: ResolvedScanConfig,
): ScanExecutionResult {
  // `diagnostics` stays raw (and cached raw); overrides and the baseline
  // ratchet only shape what is reported and what fails the run.
  const afterOverrides = applyOverrides(diagnostics, config.overrides, process.cwd());
  const effective = config.baseline
    ? applyBaseline(afterOverrides, config.baseline, process.cwd())
    : afterOverrides;
  const visibleDiagnostics = config.showSeverities
    ? effective.filter((d) => config.showSeverities?.has(d.severity))
    : effective;

  return {
    diagnostics,
    visibleDiagnostics,
    fileCount,
    exitCode: computeExitCode(effective, config.failOn),
  };
}

/**
 * Re-resolve severities per file: each override whose globs (gitignore
 * syntax, matched against the cwd-relative path) cover the diagnostic's file
 * applies its rule policy on top of the already-resolved severity. `off`
 * drops the diagnostic.
 */
export function applyOverrides(
  diagnostics: Diagnostic[],
  overrides: ResolvedRuleOverride[],
  cwd: string,
): Diagnostic[] {
  if (overrides.length === 0) return diagnostics;
  const matchers = overrides.map((entry) => ({
    matcher: ignore().add(entry.files),
    rulePolicy: entry.rulePolicy,
  }));

  const result: Diagnostic[] = [];
  for (const diagnostic of diagnostics) {
    const relPath = relative(cwd, diagnostic.file).replaceAll("\\", "/");
    const metadata = getRuleMetadata(diagnostic.ruleId);
    const descriptor = {
      rule: { id: diagnostic.ruleId },
      category: metadata.category,
      tags: metadata.tags,
      confidence: metadata.confidence,
    };

    let severity: RulePolicySeverity = diagnostic.severity;
    for (const { matcher, rulePolicy } of matchers) {
      if (relPath.startsWith("..") || !matcher.ignores(relPath)) continue;
      for (const entry of rulePolicy) {
        if (!matchesSelector(descriptor, entry.selector)) continue;
        severity = entry.severity;
      }
    }

    if (severity === "off") continue;
    result.push(severity === diagnostic.severity ? diagnostic : { ...diagnostic, severity });
  }
  return result;
}

export function toScanResult(execution: ScanExecutionResult): ScanResult {
  return {
    diagnostics: execution.diagnostics,
    fileCount: execution.fileCount,
  };
}

export function computeExitCode(diagnostics: Diagnostic[], failOn: "none" | Severity): number {
  if (failOn === "none") return 0;

  const hasError = diagnostics.some((d) => d.severity === "error");
  const hasWarning = diagnostics.some((d) => d.severity === "warning");
  const hasInfo = diagnostics.some((d) => d.severity === "info");

  if (failOn === "error") return hasError ? 2 : 0;
  if (failOn === "warning") {
    if (hasError) return 2;
    return hasWarning ? 1 : 0;
  }

  if (hasError) return 2;
  if (hasWarning || hasInfo) return 1;
  return 0;
}
