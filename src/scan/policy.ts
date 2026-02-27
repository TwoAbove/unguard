import type { Diagnostic, Rule } from "../rules/types.ts";
import { getRuleMetadata } from "../rules/index.ts";
import type {
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
    };
  });
}

export function resolveActiveRules(
  descriptors: RuleDescriptor[],
  config: ResolvedScanConfig,
): Rule[] {
  const selectedRules = config.rules ? new Set(config.rules) : null;
  const active: Rule[] = [];

  for (const descriptor of descriptors) {
    if (selectedRules && !selectedRules.has(descriptor.rule.id)) continue;
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

function matchesSelector(descriptor: RuleDescriptor, selector: string): boolean {
  if (selector.startsWith("category:")) {
    return descriptor.category === selector.slice("category:".length);
  }
  if (selector.startsWith("tag:")) {
    return descriptor.tags.includes(selector.slice("tag:".length));
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
  const visibleDiagnostics = config.showSeverities
    ? diagnostics.filter((d) => config.showSeverities?.has(d.severity))
    : diagnostics;

  return {
    diagnostics,
    visibleDiagnostics,
    fileCount,
    exitCode: computeExitCode(diagnostics, config.failOn),
  };
}

export function toScanResult(execution: ScanExecutionResult): ScanResult {
  return {
    diagnostics: execution.diagnostics,
    fileCount: execution.fileCount,
  };
}

function computeExitCode(diagnostics: Diagnostic[], failOn: "none" | Severity): number {
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
