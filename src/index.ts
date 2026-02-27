export { executeScan, scan, type ScanExecutionResult, type ScanOptions, type ScanResult } from "./engine.ts";
export type { Diagnostic, Rule, CrossFileRule, TSRule, TSVisitContext } from "./rules/types.ts";
export { allRules, getRuleMetadata, type RuleCategory, type RuleMetadata } from "./rules/index.ts";
