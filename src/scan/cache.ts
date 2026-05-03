import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Diagnostic, Rule } from "../rules/types.ts";
import type { Severity } from "./types.ts";

const CACHE_VERSION = 1;
const CACHE_FILENAME = "scan-cache.json";

export interface ScanCacheEntry {
  version: number;
  unguardVersion: string;
  /** Hash of active rules + ignore globs + paths + severity policy. Mismatch -> cache miss. */
  scanKey: string;
  /** `<size>:<mtimeNs>@<contentHash>` per file. Stat fast-path skips hashing when stat matches. */
  fileHashes: Record<string, string>;
  diagnostics: Diagnostic[];
  fileCount: number;
}

export interface ScanKeyInput {
  unguardVersion: string;
  rules: readonly Rule[];
  paths: readonly string[];
  ignore: readonly string[];
  strict: boolean;
  failOn: string;
  showSeverities: ReadonlySet<Severity> | null;
}

export interface CacheCheckContext {
  unguardVersion: string;
  scanKey: string;
}

/** Walk up from `startDir` to the nearest `node_modules`, returning its `.cache/unguard/v<N>` subdir. */
export function resolveCacheDir(startDir: string): string | null {
  let dir = startDir;
  for (;;) {
    const nm = join(dir, "node_modules");
    if (existsSync(nm)) return join(nm, ".cache", "unguard", `v${CACHE_VERSION}`);
    const parent = join(dir, "..");
    if (parent === dir) return null;
    dir = parent;
  }
}

export function computeScanKey(input: ScanKeyInput): string {
  const ruleSig = [...input.rules]
    .map((r) => `${r.id}=${r.severity}`)
    .sort()
    .join(",");
  const payload = JSON.stringify({
    unguardVersion: input.unguardVersion,
    ruleSig,
    paths: [...input.paths].sort(),
    ignore: [...input.ignore].sort(),
    strict: input.strict,
    failOn: input.failOn,
    showSeverities: input.showSeverities ? [...input.showSeverities].sort() : null,
  });
  return createHash("sha256").update(payload).digest("hex").slice(0, 16);
}

export function hashFile(path: string, prevFingerprint: string | undefined): string {
  const s = statSync(path, { bigint: true });
  const statTag = `${s.size}:${s.mtimeNs.toString()}`;
  if (prevFingerprint !== undefined) {
    const prevStat = prevFingerprint.split("@", 1)[0];
    if (prevStat === statTag) return prevFingerprint;
  }
  const buf = readFileSync(path);
  const contentHash = createHash("sha1").update(buf).digest("hex").slice(0, 16);
  return `${statTag}@${contentHash}`;
}

export function hashFiles(paths: readonly string[], prev: Record<string, string> | null): Record<string, string> {
  const result: Record<string, string> = {};
  for (const path of paths) {
    result[path] = hashFile(path, prev?.[path]);
  }
  return result;
}

export function readScanCache(dir: string): ScanCacheEntry | null {
  const path = join(dir, CACHE_FILENAME);
  if (!existsSync(path)) return null;

  const text = trySync(() => readFileSync(path, "utf8"), "read failed");
  if (text === null) return null;

  const raw = trySync(() => JSON.parse(text) as unknown, "parse failed");
  if (raw === null) return null;

  return validateScanCache(raw);
}

export function writeScanCache(dir: string, entry: ScanCacheEntry): void {
  trySync(() => {
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, CACHE_FILENAME), JSON.stringify(entry));
    return true;
  }, "write failed");
}

/** Cache hit iff scan config matches and every file's content hash matches. Ignores stat. */
export function cacheCovers(
  cached: ScanCacheEntry,
  context: CacheCheckContext,
  currentHashes: Record<string, string>,
): boolean {
  if (cached.unguardVersion !== context.unguardVersion) return false;
  if (cached.scanKey !== context.scanKey) return false;

  const cachedFiles = Object.keys(cached.fileHashes);
  const currentFiles = Object.keys(currentHashes);
  if (cachedFiles.length !== currentFiles.length) return false;

  for (const file of currentFiles) {
    const prev = cached.fileHashes[file];
    const cur = currentHashes[file];
    if (prev === undefined || cur === undefined) return false;
    if (contentHashOf(prev) !== contentHashOf(cur)) return false;
  }
  return true;
}

function contentHashOf(fingerprint: string): string {
  const idx = fingerprint.indexOf("@");
  return idx >= 0 ? fingerprint.slice(idx + 1) : fingerprint;
}

function validateScanCache(raw: unknown): ScanCacheEntry | null {
  if (typeof raw !== "object" || raw === null) return null;
  const entry = raw as Record<string, unknown>;
  if (entry.version !== CACHE_VERSION) return null;
  if (typeof entry.scanKey !== "string") return null;
  if (typeof entry.unguardVersion !== "string") return null;
  if (typeof entry.fileCount !== "number") return null;

  const fileHashes = validateFileHashes(entry.fileHashes);
  if (fileHashes === null) return null;

  const diagnostics = validateDiagnostics(entry.diagnostics);
  if (diagnostics === null) return null;

  return {
    version: entry.version,
    unguardVersion: entry.unguardVersion,
    scanKey: entry.scanKey,
    fileHashes,
    diagnostics,
    fileCount: entry.fileCount,
  };
}

function validateFileHashes(raw: unknown): Record<string, string> | null {
  if (typeof raw !== "object" || raw === null) return null;
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value !== "string") return null;
    result[key] = value;
  }
  return result;
}

function validateDiagnostics(raw: unknown): Diagnostic[] | null {
  if (!Array.isArray(raw)) return null;
  const list: Diagnostic[] = [];
  for (const item of raw) {
    const diag = validateDiagnostic(item);
    if (diag === null) return null;
    list.push(diag);
  }
  return list;
}

function validateDiagnostic(item: unknown): Diagnostic | null {
  if (typeof item !== "object" || item === null) return null;
  if (!("file" in item) || typeof item.file !== "string") return null;
  if (!("ruleId" in item) || typeof item.ruleId !== "string") return null;
  if (!("line" in item) || typeof item.line !== "number") return null;
  if (!("column" in item) || typeof item.column !== "number") return null;
  if (!("severity" in item)) return null;
  if (item.severity !== "error" && item.severity !== "warning" && item.severity !== "info") return null;
  if (!("message" in item) || typeof item.message !== "string") return null;
  const annotation = "annotation" in item ? item.annotation : undefined;
  if (annotation !== undefined && typeof annotation !== "string") return null;
  return {
    file: item.file,
    ruleId: item.ruleId,
    line: item.line,
    column: item.column,
    severity: item.severity,
    message: item.message,
    annotation,
  };
}

function trySync<T>(fn: () => T, label: string): T | null {
  try {
    return fn();
  } catch (err) {
    return debugLog(label, err);
  }
}

function debugLog(label: string, err: unknown): null {
  if (process.env.UNGUARD_DEBUG !== undefined) {
    console.error(`[unguard] cache ${label}:`, err);
  }
  return null;
}
