import type { Diagnostic, Rule } from "../rules/types.ts";
import type { RuleCategory } from "../rules/index.ts";

export type Severity = Diagnostic["severity"];
export type RulePolicySeverity = Severity | "off";
export type FailOn = "none" | Severity;

export interface RulePolicyEntry {
  selector: string;
  severity: RulePolicySeverity;
}

export type RulePolicy = Record<string, RulePolicySeverity> | RulePolicyEntry[];

export interface ScanOptions {
  paths: string[];
  strict?: boolean;
  rules?: string[];
  ignore?: string[];
  rulePolicy?: RulePolicy;
  showSeverities?: Severity[];
  failOn?: FailOn;
  useGitIgnore?: boolean;
  /** Worker threads for tsconfig groups. Auto by default; 1 disables. */
  concurrency?: number;
  /** On-disk diagnostic cache under `node_modules/.cache/unguard/`. Default: true. */
  cache?: boolean;
}

export interface ResolvedScanConfig {
  paths: string[];
  strict: boolean;
  rules: string[] | null;
  ignore: string[];
  rulePolicy: RulePolicyEntry[];
  showSeverities: Set<Severity> | null;
  failOn: FailOn;
  useGitIgnore: boolean;
  concurrency: number | undefined;
  cache: boolean;
}

export interface RuleDescriptor {
  rule: Rule;
  category: RuleCategory;
  tags: string[];
}

export interface ScanResult {
  diagnostics: Diagnostic[];
  fileCount: number;
}

export interface ScanExecutionResult extends ScanResult {
  visibleDiagnostics: Diagnostic[];
  exitCode: number;
}
