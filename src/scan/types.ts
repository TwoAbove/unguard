import type { Diagnostic, Rule } from "../rules/types.ts";
import type { RuleCategory, RuleConfidence } from "../rules/index.ts";
import type { BaselineData } from "./baseline.ts";

export type Severity = Diagnostic["severity"];
export type RulePolicySeverity = Severity | "off";
export type FailOn = "none" | Severity;

/**
 * `scan` runs proven rules — every finding demands a fix. `audit` runs
 * heuristic rules — findings are review prompts. An explicit `rules` filter
 * bypasses the split: asking for a rule by name runs it in either mode.
 */
export type ScanMode = "scan" | "audit";

export interface RulePolicyEntry {
  selector: string;
  severity: RulePolicySeverity;
}

export type RulePolicy = Record<string, RulePolicySeverity> | RulePolicyEntry[];

/** Per-path rule policy: applies to diagnostics in files matching the globs. */
export interface RuleOverride {
  files: string[];
  rules: RulePolicy;
}

export interface ScanOptions {
  paths: string[];
  mode?: ScanMode;
  strict?: boolean;
  rules?: string[];
  ignore?: string[];
  rulePolicy?: RulePolicy;
  /** Path-scoped rule policies, applied after the global policy. */
  overrides?: RuleOverride[];
  showSeverities?: Severity[];
  failOn?: FailOn;
  useGitIgnore?: boolean;
  /** Worker threads for tsconfig groups. Auto by default; 1 disables. */
  concurrency?: number;
  /** On-disk diagnostic cache under `node_modules/.cache/unguard/`. Default: true. */
  cache?: boolean;
  /** Known-issue ratchet: suppress (file, rule) groups within baselined counts. */
  baseline?: BaselineData;
}

export interface ResolvedRuleOverride {
  files: string[];
  rulePolicy: RulePolicyEntry[];
}

export interface ResolvedScanConfig {
  paths: string[];
  mode: ScanMode;
  strict: boolean;
  rules: string[] | null;
  ignore: string[];
  rulePolicy: RulePolicyEntry[];
  overrides: ResolvedRuleOverride[];
  showSeverities: Set<Severity> | null;
  failOn: FailOn;
  useGitIgnore: boolean;
  concurrency: number | undefined;
  cache: boolean;
  baseline: BaselineData | null;
}

export interface RuleDescriptor {
  rule: Rule;
  category: RuleCategory;
  tags: string[];
  confidence: RuleConfidence;
}

export interface ScanResult {
  diagnostics: Diagnostic[];
  fileCount: number;
}

export interface ScanExecutionResult extends ScanResult {
  visibleDiagnostics: Diagnostic[];
  exitCode: number;
}
