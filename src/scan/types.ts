import type { Diagnostic, Rule } from "../rules/types.ts";
import type { RuleCategory, RuleTier } from "../rules/index.ts";
import type { BaselineData } from "./baseline.ts";

export type Severity = Diagnostic["severity"];
export type RulePolicySeverity = Severity | "off";
export type FailOn = "none" | Severity;

/**
 * `scan` runs finding-tier rules, whose reports demand a fix. `smell` runs
 * smell-tier rules, whose reports need a human decision. Explicit `rules`
 * selectors bypass the split and run matching rules in either mode.
 */
export type ScanMode = "scan" | "smell";

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
  /** Rule selectors to run, bypassing the mode's tier split. */
  rules?: string[];
  ignore?: string[];
  rulePolicy?: RulePolicy;
  /** Path-scoped rule policies, applied after the global policy. */
  overrides?: RuleOverride[];
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
  rules: string[] | null;
  ignore: string[];
  rulePolicy: RulePolicyEntry[];
  overrides: ResolvedRuleOverride[];
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
  tier: RuleTier;
}

export interface ScanResult {
  diagnostics: Diagnostic[];
  fileCount: number;
}

export interface ScanExecutionResult extends ScanResult {
  visibleDiagnostics: Diagnostic[];
  exitCode: number;
}
