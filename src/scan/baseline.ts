import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import type { Diagnostic } from "../rules/types.ts";

export const BASELINE_FILENAME = "unguard.baseline.json";

/**
 * Ratchet file: known-issue counts per (file, rule). A scan suppresses a
 * group while its count stays at or below the recorded number; the moment it
 * exceeds the baseline, the whole group surfaces — line numbers shift too
 * easily to pin individual diagnostics, counts only ratchet downward.
 */
export interface BaselineData {
  version: 1;
  rules: Record<string, Record<string, number>>;
}

export function buildBaseline(diagnostics: Diagnostic[], cwd: string): BaselineData {
  const rules: Record<string, Record<string, number>> = {};
  for (const diagnostic of diagnostics) {
    const file = relative(cwd, diagnostic.file);
    rules[file] ??= {};
    const forFile = rules[file];
    forFile[diagnostic.ruleId] = (forFile[diagnostic.ruleId] ?? 0) + 1;
  }
  return { version: 1, rules };
}

export function writeBaseline(baseline: BaselineData, cwd: string): string {
  const path = resolve(cwd, BASELINE_FILENAME);
  writeFileSync(path, `${JSON.stringify(baseline, null, 2)}\n`, "utf8");
  return path;
}

export function loadBaseline(cwd: string): BaselineData | null {
  const path = resolve(cwd, BASELINE_FILENAME);
  if (!existsSync(path)) return null;
  const parsed: unknown = JSON.parse(readFileSync(path, "utf8"));
  if (!isBaselineData(parsed)) {
    throw new Error(`Invalid baseline in ${BASELINE_FILENAME}: expected {"version": 1, "rules": {<file>: {<ruleId>: count}}}.`);
  }
  return parsed;
}

function isBaselineData(value: unknown): value is BaselineData {
  if (typeof value !== "object" || value === null) return false;
  if (!("version" in value) || value.version !== 1) return false;
  if (!("rules" in value) || typeof value.rules !== "object" || value.rules === null) return false;
  return Object.values(value.rules).every(
    (forFile) =>
      typeof forFile === "object" &&
      forFile !== null &&
      Object.values(forFile).every((count) => typeof count === "number"),
  );
}

/** Drop diagnostic groups still within their baselined count. */
export function applyBaseline(diagnostics: Diagnostic[], baseline: BaselineData, cwd: string): Diagnostic[] {
  const groups = new Map<string, Diagnostic[]>();
  for (const diagnostic of diagnostics) {
    const key = `${relative(cwd, diagnostic.file)}\0${diagnostic.ruleId}`;
    let list = groups.get(key);
    if (list === undefined) {
      list = [];
      groups.set(key, list);
    }
    list.push(diagnostic);
  }

  const kept: Diagnostic[] = [];
  for (const [key, group] of groups) {
    const [file, ruleId] = key.split("\0") as [string, string];
    const allowed = baseline.rules[file]?.[ruleId] ?? 0;
    if (group.length <= allowed) continue;
    kept.push(...group);
  }
  return kept;
}
