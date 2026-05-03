import { availableParallelism } from "node:os";
import { allRules } from "./rules/index.ts";
import { analyzeFiles } from "./scan/analyze.ts";
import { cacheCovers, computeScanKey, hashFiles, readScanCache, resolveCacheDir, writeScanCache } from "./scan/cache.ts";
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

const UNGUARD_VERSION = "0.15.1";

export async function executeScan(options: ScanOptions): Promise<ScanExecutionResult> {
  const config = resolveScanConfig(options);
  const files = await discoverFiles(config);
  const descriptors = buildRuleDescriptors(allRules);
  const activeRules = resolveActiveRules(descriptors, config);

  const cacheDir = config.cache ? resolveCacheDir(process.cwd()) : null;
  if (cacheDir !== null) {
    const scanKey = computeScanKey({
      unguardVersion: UNGUARD_VERSION,
      rules: activeRules,
      paths: config.paths,
      ignore: config.ignore,
      strict: config.strict,
      failOn: config.failOn,
      showSeverities: config.showSeverities,
    });
    const cached = readScanCache(cacheDir);
    const sortedFiles = [...files].sort();
    const currentHashes = hashFiles(sortedFiles, cached?.fileHashes ?? null);

    if (cached !== null && cacheCovers(cached, { unguardVersion: UNGUARD_VERSION, scanKey }, currentHashes)) {
      return finalizeScanResult(cached.diagnostics, cached.fileCount, config);
    }

    const concurrency = resolveDefaultConcurrency(config.concurrency);
    const diagnostics = await analyzeFiles(files, activeRules, { concurrency });
    writeScanCache(cacheDir, {
      version: 1,
      unguardVersion: UNGUARD_VERSION,
      scanKey,
      fileHashes: currentHashes,
      diagnostics,
      fileCount: files.length,
    });
    return finalizeScanResult(diagnostics, files.length, config);
  }

  const concurrency = resolveDefaultConcurrency(config.concurrency);
  const diagnostics = await analyzeFiles(files, activeRules, { concurrency });
  return finalizeScanResult(diagnostics, files.length, config);
}

function resolveDefaultConcurrency(requested: number | undefined): number {
  if (requested !== undefined) {
    if (!Number.isFinite(requested) || requested < 1) return 1;
    return Math.floor(requested);
  }
  // Each worker holds its own ts.Program; cap at half the CPUs to avoid memory blow-up on shared CI.
  const cores = availableParallelism();
  return Math.min(8, Math.max(1, Math.ceil(cores / 2)));
}

export async function scan(options: ScanOptions): Promise<ScanResult> {
  const execution = await executeScan(options);
  return toScanResult(execution);
}
