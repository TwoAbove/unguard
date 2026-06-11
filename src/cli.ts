import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { basename, relative, resolve } from "node:path";
import { parseArgs } from "node:util";
import pc from "picocolors";
import { executeScan, type FailOn, type RulePolicyEntry, type RulePolicySeverity, type Severity } from "./engine.ts";
import { BASELINE_FILENAME, buildBaseline, loadBaseline, writeBaseline, type BaselineData } from "./scan/baseline.ts";
import { isFailOn, isRulePolicySeverity, isSeverity, toRulePolicyEntries } from "./scan/config.ts";
import { computeExitCode } from "./scan/policy.ts";
import type { RulePolicy, RuleOverride } from "./scan/types.ts";
import type { Diagnostic } from "./rules/types.ts";

interface UnguardConfig {
  paths?: string[];
  ignore?: string[];
  rules?: RulePolicy;
  overrides?: RuleOverride[];
  failOn?: FailOn;
  severity?: Severity[];
  concurrency?: number;
  cache?: boolean;
}

const COMMANDS = new Set(["scan", "audit", "baseline"]);

// @unguard unused-export CLI entry point
export async function main(argv: string[]): Promise<number> {
  const rawArgs = argv.slice(2);
  const first = rawArgs[0];
  const command = first !== undefined && COMMANDS.has(first) ? first : "scan";
  const userArgs = first !== undefined && COMMANDS.has(first) ? rawArgs.slice(1) : rawArgs;

  const { values, positionals: cliPaths } = parseArgs({
    args: userArgs,
    options: {
      strict: { type: "boolean", default: false },
      filter: { type: "string" },
      fix: { type: "boolean", default: false },
      format: { type: "string", default: "grouped" },
      severity: { type: "string", multiple: true, default: [] },
      ignore: { type: "string", multiple: true, default: [] },
      rule: { type: "string", multiple: true, default: [] },
      config: { type: "string" },
      "fail-on": { type: "string" },
      concurrency: { type: "string" },
      "no-baseline": { type: "boolean", default: false },
      "no-cache": { type: "boolean", default: false },
      help: { type: "boolean", short: "h", default: false },
    },
    allowPositionals: true,
  });

  if (values.help) {
    printHelp();
    return 0;
  }

  if (values.format !== "grouped" && values.format !== "flat" && values.format !== "json") {
    console.error(pc.red(`Invalid --format value "${values.format}". Use grouped, flat, or json.`));
    return 1;
  }

  let config: UnguardConfig | null = null;
  try {
    const configPath = findConfigPath(values.config);
    config = configPath ? loadConfig(configPath) : null;
  } catch (err) {
    return printErrorAndFail(err);
  }

  const rulePolicyResult = parseRulePolicyArgs(values.rule);
  if (!rulePolicyResult.ok) {
    console.error(pc.red(rulePolicyResult.message));
    return 1;
  }

  const severityFiltersResult = parseSeverityFilters(values.severity);
  if (!severityFiltersResult.ok) {
    console.error(pc.red(severityFiltersResult.message));
    return 1;
  }

  // Only an explicit --fail-on makes audit exit nonzero; config failOn
  // applies to scan only.
  const failOnResult = command === "audit"
    ? resolveFailOn(values["fail-on"], "none")
    : resolveFailOn(values["fail-on"], "info", config?.failOn);
  if (!failOnResult.ok) {
    console.error(pc.red(failOnResult.message));
    return 1;
  }

  const concurrencyResult = resolveConcurrency(values.concurrency, config?.concurrency);
  if (!concurrencyResult.ok) {
    console.error(pc.red(concurrencyResult.message));
    return 1;
  }

  const paths = cliPaths.length > 0 ? cliPaths : config?.paths ?? [];
  const ignore = [...(config?.ignore ?? []), ...values.ignore];
  const rulePolicy = [
    ...toRulePolicyEntries(config?.rules),
    ...rulePolicyResult.value,
  ];

  const cacheEnabled = values["no-cache"] ? false : config?.cache ?? true;

  // The baseline subcommand regenerates the file, so the existing one must
  // not suppress anything during its scan.
  let baseline: BaselineData | null = null;
  if (command === "scan" && !values["no-baseline"]) {
    try {
      baseline = loadBaseline(process.cwd());
    } catch (err) {
      return printErrorAndFail(err);
    }
  }

  const execution = await executeScan({
    paths,
    mode: command === "audit" ? "audit" : "scan",
    strict: values.strict,
    rules: values.filter ? [values.filter] : undefined,
    ignore: ignore.length > 0 ? ignore : undefined,
    rulePolicy: rulePolicy.length > 0 ? rulePolicy : undefined,
    overrides: config?.overrides,
    showSeverities: severityFiltersResult.value.length > 0 ? severityFiltersResult.value : config?.severity,
    failOn: failOnResult.value,
    concurrency: concurrencyResult.value,
    cache: cacheEnabled,
    baseline: baseline ?? undefined,
  });

  if (command === "baseline") {
    const data = buildBaseline(execution.visibleDiagnostics, process.cwd());
    writeBaseline(data, process.cwd());
    console.log(
      `Baseline written to ${BASELINE_FILENAME}: ${plural(execution.visibleDiagnostics.length, "known issue")} across ${plural(Object.keys(data.rules).length, "file")}.`,
    );
    return 0;
  }

  let diagnostics = execution.visibleDiagnostics;
  let exitCode = execution.exitCode;
  let fixedCount = 0;
  let fixedFileCount = 0;

  if (values.fix) {
    const result = applyFixes(diagnostics);
    fixedCount = result.applied;
    fixedFileCount = result.fileCount;
    diagnostics = diagnostics.filter((d) => !result.fixed.has(d));
    exitCode = computeExitCode(diagnostics, failOnResult.value);
  }

  if (values.format === "json") {
    console.log(JSON.stringify(buildJsonReport(diagnostics, execution.fileCount, exitCode, values.fix ? fixedCount : null), null, 2));
    return exitCode;
  }

  if (baseline !== null) {
    console.log(pc.dim(`Using ${BASELINE_FILENAME} (run "unguard baseline" to regenerate, --no-baseline to ignore)`));
  }
  if (values.fix && fixedCount > 0) {
    console.log(pc.green(`Applied ${fixedCount} fix${fixedCount === 1 ? "" : "es"} in ${fixedFileCount} file${fixedFileCount === 1 ? "" : "s"}. Re-run unguard to verify.`));
  }

  if (diagnostics.length === 0) {
    console.log(pc.green(`No issues found in ${plural(execution.fileCount, "file")}.`));
    return exitCode;
  }

  if (values.format === "flat") {
    printDiagnosticsFlat(diagnostics);
  } else {
    printDiagnostics(diagnostics);
  }
  printSummary(diagnostics, execution.fileCount);

  return exitCode;
}

interface JsonDiagnostic {
  file: string;
  line: number;
  column: number;
  severity: Severity;
  ruleId: string;
  message: string;
  annotation?: string;
  fixable: boolean;
}

function buildJsonReport(
  diagnostics: Diagnostic[],
  fileCount: number,
  exitCode: number,
  fixedCount: number | null,
): { diagnostics: JsonDiagnostic[]; fileCount: number; exitCode: number; fixedCount?: number } {
  return {
    diagnostics: diagnostics.map((d) => ({
      file: d.file,
      line: d.line,
      column: d.column,
      severity: d.severity,
      ruleId: d.ruleId,
      message: d.message,
      ...(d.annotation !== undefined ? { annotation: d.annotation } : {}),
      fixable: d.fix !== undefined,
    })),
    fileCount,
    exitCode,
    ...(fixedCount !== null ? { fixedCount } : {}),
  };
}

/**
 * Apply fix edits, last-to-first per file so earlier offsets stay valid.
 * Overlapping edits in one pass are skipped — the re-run picks them up.
 */
function applyFixes(diagnostics: Diagnostic[]): { applied: number; fileCount: number; fixed: Set<Diagnostic> } {
  const byFile = groupByFile(diagnostics.filter((d) => d.fix !== undefined));

  const fixed = new Set<Diagnostic>();
  for (const [file, fileDiagnostics] of byFile) {
    const ordered = [...fileDiagnostics].sort((a, b) => (b.fix?.start ?? 0) - (a.fix?.start ?? 0));
    let content = readFileSync(file, "utf8");
    let lastAppliedStart = Number.POSITIVE_INFINITY;
    for (const diagnostic of ordered) {
      const fix = diagnostic.fix;
      if (fix === undefined) continue;
      if (fix.end > lastAppliedStart) continue;
      content = content.slice(0, fix.start) + fix.text + content.slice(fix.end);
      lastAppliedStart = fix.start;
      fixed.add(diagnostic);
    }
    writeFileSync(file, content, "utf8");
  }

  return { applied: fixed.size, fileCount: byFile.size, fixed };
}

function groupByFile(diagnostics: Diagnostic[]): Map<string, Diagnostic[]> {
  const byFile = new Map<string, Diagnostic[]>();
  for (const diagnostic of diagnostics) {
    let list = byFile.get(diagnostic.file);
    if (list === undefined) {
      list = [];
      byFile.set(diagnostic.file, list);
    }
    list.push(diagnostic);
  }
  return byFile;
}

/** Surface a failure as output + exit code 1 instead of a thrown error. */
function printErrorAndFail(err: unknown): number {
  const message = err instanceof Error ? err.message : String(err);
  console.error(pc.red(message));
  return 1;
}

function printHelp() {
  console.log(`unguard: data-shape static analyzer

Usage:
  unguard scan [paths...] [options]
  unguard audit [paths...] [options]
  unguard baseline [paths...] [options]
  unguard [paths...] [options]

Commands:
  scan                  Run proven rules: every finding demands a fix (default)
  audit                 Run heuristic rules: findings surface for review, exit
                        code is 0 unless --fail-on is passed explicitly
  baseline              Record current issues in unguard.baseline.json; later
                        scans suppress a (file, rule) group until its count
                        grows past the recorded number

Options:
  --config <path>       Path to unguard config file (defaults to ./unguard.config.json)
  --strict              Treat all diagnostics as errors
  --filter <rule>       Run only the specified rule (in either command)
  --fix                 Apply available auto-fixes, then report what remains
  --rule <sel=sev>      Override rule severity (supports id, *, category:<name>,
                        tag:<name>, confidence:<proven|heuristic>)
  --ignore <glob>       Ignore path glob. Repeatable.
  --severity <levels>   Filter output by severity (comma-separated and/or repeatable)
  --fail-on <level>     Exit threshold: none, error, warning, info (default: info)
  --format <mode>       Output format: grouped (default), flat, or json
  --concurrency <n>     Worker threads for tsconfig groups (default: auto, 1 disables)
  --no-baseline         Ignore unguard.baseline.json for this scan
  --no-cache            Disable on-disk diagnostic cache (node_modules/.cache/unguard)
  -h, --help            Show this help

Exit codes:
  0  Clean, or does not meet --fail-on threshold
  1  Meets threshold without errors
  2  Meets threshold with at least one error

Examples:
  unguard scan src
  unguard audit src
  unguard scan src --fix
  unguard scan src --format=json
  unguard baseline src
  unguard scan src --rule duplicate-*=warning
  unguard scan src --rule category:cross-file=warning
  unguard scan src --rule tag:safety=error
  unguard scan src --severity=error,warning
  unguard scan src --fail-on=error`);
}

function printDiagnostics(diagnostics: Diagnostic[]) {
  const byFile = groupByFile(diagnostics);

  const cwd = `${process.cwd()}/`;
  const cwdBase = process.cwd();

  // "  " + location column + " " + severity column + "  "
  const prefixWidth = 2 + 10 + 1 + 7 + 2;
  const columns = process.stdout.columns;
  const wrapWidth = columns !== undefined && columns > prefixWidth + 20 ? columns - prefixWidth : null;

  for (const [file, fileDiagnostics] of byFile) {
    const rel = relative(cwdBase, file);
    console.log(pc.underline(rel));

    for (const diagnostic of fileDiagnostics) {
      const loc = `${diagnostic.line}:${diagnostic.column}`;
      const sev = diagnostic.severity === "error"
        ? pc.red("error".padEnd(7))
        : diagnostic.severity === "warning"
        ? pc.yellow("warning")
        : pc.blue("info".padEnd(7));
      const msg = diagnostic.message.replaceAll(cwd, "");
      const head = `  ${pc.dim(loc.padEnd(10))} ${sev}  `;
      const rule = pc.dim(diagnostic.ruleId);
      const annotation = diagnostic.annotation !== undefined ? `  ${pc.cyan(diagnostic.annotation)}` : "";

      if (wrapWidth === null) {
        console.log(`${head}${msg}  ${rule}${annotation}`);
        continue;
      }

      const lines = wrapWords(msg, wrapWidth);
      const tailWidth = diagnostic.ruleId.length + (diagnostic.annotation !== undefined ? 2 + diagnostic.annotation.length : 0);
      const last = lines.length - 1;
      const tailFits = (lines[last]?.length ?? 0) + 2 + tailWidth <= wrapWidth;
      const indent = " ".repeat(prefixWidth);
      for (let i = 0; i < lines.length; i++) {
        const start = i === 0 ? head : indent;
        const tail = i === last && tailFits ? `  ${rule}${annotation}` : "";
        console.log(`${start}${lines[i]}${tail}`);
      }
      if (!tailFits) console.log(`${indent}${rule}${annotation}`);
    }

    console.log();
  }
}

/** Greedy word wrap; words longer than the width get their own line unbroken. */
function wrapWords(text: string, width: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(" ")) {
    if (line === "") {
      line = word;
    } else if (line.length + 1 + word.length > width) {
      lines.push(line);
      line = word;
    } else {
      line += ` ${word}`;
    }
  }
  if (line !== "") lines.push(line);
  return lines;
}

function printDiagnosticsFlat(diagnostics: Diagnostic[]) {
  const cwdBase = process.cwd();
  const cwd = `${cwdBase}/`;

  for (const diagnostic of diagnostics) {
    const rel = relative(cwdBase, diagnostic.file);
    const msg = diagnostic.message.replaceAll(cwd, "");
    console.log(`${rel}:${diagnostic.line}:${diagnostic.column} ${diagnostic.severity} [${diagnostic.ruleId}] ${msg}`);
  }
}

function printSummary(diagnostics: Diagnostic[], fileCount: number) {
  const counts = new Map<string, number>();
  for (const diagnostic of diagnostics) {
    const prev = counts.get(diagnostic.ruleId);
    counts.set(diagnostic.ruleId, (prev === undefined ? 0 : prev) + 1);
  }

  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const maxRule = Math.max(...sorted.map(([rule]) => rule.length));

  console.log(pc.bold("Summary"));
  for (const [rule, count] of sorted) {
    console.log(`  ${rule.padEnd(maxRule)}  ${pc.bold(String(count))}`);
  }

  console.log(
    `\n${pc.bold(String(diagnostics.length))} issue${diagnostics.length === 1 ? "" : "s"} in ${plural(fileCount, "file")}.`,
  );
}

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

function parseSeverityFilters(values: string[]): { ok: true; value: Severity[] } | { ok: false; message: string } {
  const levels = splitCsv(values);
  const parsed: Severity[] = [];
  for (const value of levels) {
    if (!isSeverity(value)) {
      return { ok: false, message: `Invalid --severity value "${value}". Use error, warning, info.` };
    }
    parsed.push(value);
  }
  return { ok: true, value: parsed };
}

function parseRulePolicyArgs(values: string[]): { ok: true; value: RulePolicyEntry[] } | { ok: false; message: string } {
  const entries: RulePolicyEntry[] = [];

  for (const arg of values) {
    const separator = resolveRuleSeparator(arg);
    if (separator === null) {
      return { ok: false, message: `Invalid --rule value "${arg}". Use <selector>=<off|info|warning|error>.` };
    }

    const selector = arg.slice(0, separator).trim();
    const severity = arg.slice(separator + 1).trim();
    if (!selector) {
      return { ok: false, message: `Invalid --rule value "${arg}". Rule selector is required.` };
    }
    if (!isRulePolicySeverity(severity)) {
      return { ok: false, message: `Invalid --rule value "${arg}". Severity must be off, info, warning, or error.` };
    }

    entries.push({ selector, severity });
  }

  return { ok: true, value: entries };
}

function resolveRuleSeparator(value: string): number | null {
  const equalIndex = value.indexOf("=");
  if (equalIndex >= 0) return equalIndex;
  const colonIndex = value.lastIndexOf(":");
  if (colonIndex <= 0) return null;
  return colonIndex;
}

function splitCsv(values: string[]): string[] {
  return values
    .flatMap((value) => value.split(","))
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}

function findConfigPath(cliValue: string | undefined): string | null {
  if (cliValue) {
    const explicitPath = resolve(process.cwd(), cliValue);
    if (!existsSync(explicitPath)) throw new Error(`Config file not found: ${cliValue}`);
    return explicitPath;
  }

  const candidates = ["unguard.config.json", ".unguardrc.json"];
  for (const candidate of candidates) {
    const candidatePath = resolve(process.cwd(), candidate);
    if (existsSync(candidatePath)) return candidatePath;
  }
  return null;
}

function loadConfig(path: string): UnguardConfig {
  const text = readFileSync(path, "utf8");
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Invalid JSON in ${basename(path)}: ${message}`);
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error(`Invalid config in ${basename(path)}: expected a JSON object.`);
  }

  const raw = parsed as Record<string, unknown>;
  const config: UnguardConfig = {};

  if (raw.paths !== undefined) {
    if (!isStringArray(raw.paths)) throw new Error(`Invalid config in ${basename(path)}: "paths" must be a string array.`);
    config.paths = raw.paths;
  }

  if (raw.ignore !== undefined) {
    if (!isStringArray(raw.ignore)) throw new Error(`Invalid config in ${basename(path)}: "ignore" must be a string array.`);
    config.ignore = raw.ignore;
  }

  if (raw.failOn !== undefined) {
    if (typeof raw.failOn !== "string" || !isFailOn(raw.failOn)) {
      throw new Error(`Invalid config in ${basename(path)}: "failOn" must be one of none, error, warning, info.`);
    }
    config.failOn = raw.failOn;
  }

  if (raw.severity !== undefined) {
    if (!isStringArray(raw.severity) || !raw.severity.every(isSeverity)) {
      throw new Error(`Invalid config in ${basename(path)}: "severity" must be an array of error, warning, info.`);
    }
    config.severity = raw.severity;
  }

  if (raw.concurrency !== undefined) {
    if (typeof raw.concurrency !== "number" || !Number.isInteger(raw.concurrency) || raw.concurrency < 1) {
      throw new Error(`Invalid config in ${basename(path)}: "concurrency" must be a positive integer.`);
    }
    config.concurrency = raw.concurrency;
  }

  if (raw.cache !== undefined) {
    if (typeof raw.cache !== "boolean") {
      throw new Error(`Invalid config in ${basename(path)}: "cache" must be a boolean.`);
    }
    config.cache = raw.cache;
  }

  if (raw.rules !== undefined) {
    config.rules = parseRulesObject(raw.rules, `"rules"`, basename(path));
  }

  if (raw.overrides !== undefined) {
    if (!Array.isArray(raw.overrides)) {
      throw new Error(`Invalid config in ${basename(path)}: "overrides" must be an array.`);
    }
    config.overrides = raw.overrides.map((entry: unknown, index) => {
      if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
        throw new Error(`Invalid config in ${basename(path)}: overrides[${index}] must be an object.`);
      }
      const override = entry as Record<string, unknown>;
      if (!isStringArray(override.files) || override.files.length === 0) {
        throw new Error(`Invalid config in ${basename(path)}: overrides[${index}].files must be a non-empty string array.`);
      }
      return {
        files: override.files,
        rules: parseRulesObject(override.rules, `overrides[${index}].rules`, basename(path)),
      };
    });
  }

  return config;
}

function parseRulesObject(value: unknown, label: string, configName: string): Record<string, RulePolicySeverity> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`Invalid config in ${configName}: ${label} must be an object.`);
  }

  const rules: Record<string, RulePolicySeverity> = {};
  for (const [selector, severity] of Object.entries(value as Record<string, unknown>)) {
    if (typeof severity !== "string" || !isRulePolicySeverity(severity)) {
      throw new Error(`Invalid config in ${configName}: rule "${selector}" in ${label} must be off, info, warning, or error.`);
    }
    rules[selector] = severity;
  }
  return rules;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}

function resolveFailOn(
  cliValue: string | undefined,
  fallback: FailOn,
  configValue?: FailOn,
): { ok: true; value: FailOn } | { ok: false; message: string } {
  const selected = cliValue ?? configValue ?? fallback;
  if (!isFailOn(selected)) {
    return { ok: false, message: `Invalid --fail-on value "${selected}". Use none, error, warning, or info.` };
  }
  return { ok: true, value: selected };
}

function resolveConcurrency(
  cliValue: string | undefined,
  configValue: number | undefined,
): { ok: true; value: number | undefined } | { ok: false; message: string } {
  if (cliValue !== undefined) {
    const parsed = Number(cliValue);
    if (!Number.isInteger(parsed) || parsed < 1) {
      return { ok: false, message: `Invalid --concurrency value "${cliValue}". Use a positive integer.` };
    }
    return { ok: true, value: parsed };
  }
  if (configValue !== undefined) {
    if (!Number.isInteger(configValue) || configValue < 1) {
      return { ok: false, message: "Invalid concurrency in config: must be a positive integer." };
    }
    return { ok: true, value: configValue };
  }
  return { ok: true, value: undefined };
}
