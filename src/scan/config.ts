import type {
  FailOn,
  ResolvedScanConfig,
  RulePolicy,
  RulePolicyEntry,
  RulePolicySeverity,
  ScanOptions,
  Severity,
} from "./types.ts";

const BUILTIN_IGNORE = [
  "**/node_modules/**",
  "**/dist/**",
  "**/.git/**",
  "**/*.d.ts",
  "**/*.d.cts",
  "**/*.d.mts",
];

const GENERATED_IGNORE = [
  "**/*.gen.*",
  "**/*.generated.*",
];

const DEFAULT_FAIL_ON: FailOn = "info";

export function resolveScanConfig(options: ScanOptions): ResolvedScanConfig {
  const paths = options.paths.length > 0 ? options.paths : ["."];
  const ignore = [...BUILTIN_IGNORE, ...GENERATED_IGNORE, ...(options.ignore ?? [])];
  return {
    paths,
    strict: options.strict ?? false,
    rules: options.rules ? [...options.rules] : null,
    ignore,
    rulePolicy: toRulePolicyEntries(options.rulePolicy),
    showSeverities: normalizeSeveritySet(options.showSeverities),
    failOn: options.failOn ?? DEFAULT_FAIL_ON,
    useGitIgnore: options.useGitIgnore ?? true,
  };
}

export function toRulePolicyEntries(policy: RulePolicy | undefined): RulePolicyEntry[] {
  if (policy === undefined) return [];
  if (Array.isArray(policy)) return [...policy];

  const entries: RulePolicyEntry[] = [];
  for (const [selector, severity] of Object.entries(policy)) {
    entries.push({ selector, severity });
  }
  return entries;
}

function normalizeSeveritySet(levels: Severity[] | undefined): Set<Severity> | null {
  if (levels === undefined || levels.length === 0) return null;
  return new Set(levels);
}

export function isRulePolicySeverity(value: string): value is RulePolicySeverity {
  return value === "off" || value === "info" || value === "warning" || value === "error";
}

export function isSeverity(value: string): value is Severity {
  return value === "info" || value === "warning" || value === "error";
}

export function isFailOn(value: string): value is FailOn {
  return value === "none" || isSeverity(value);
}
