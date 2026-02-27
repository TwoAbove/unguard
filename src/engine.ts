import { allRules } from "./rules/index.ts";
import { analyzeFiles } from "./scan/analyze.ts";
import { resolveScanConfig } from "./scan/config.ts";
import { discoverFiles } from "./scan/discover.ts";
import { buildRuleDescriptors, finalizeScanResult, resolveActiveRules, toScanResult } from "./scan/policy.ts";
import type { ScanExecutionResult, ScanOptions, ScanResult } from "./scan/types.ts";

export type {
  FailOn,
  RulePolicy,
  RulePolicyEntry,
  RulePolicySeverity,
  ScanExecutionResult,
  ScanOptions,
  ScanResult,
  Severity,
} from "./scan/types.ts";

export async function executeScan(options: ScanOptions): Promise<ScanExecutionResult> {
  const config = resolveScanConfig(options);
  const files = await discoverFiles(config);
  const descriptors = buildRuleDescriptors(allRules);
  const activeRules = resolveActiveRules(descriptors, config);
  const diagnostics = analyzeFiles(files, activeRules);
  return finalizeScanResult(diagnostics, files.length, config);
}

export async function scan(options: ScanOptions): Promise<ScanResult> {
  const execution = await executeScan(options);
  return toScanResult(execution);
}
