import { existsSync, readFileSync } from "node:fs";
import { basename, relative, resolve } from "node:path";
import { parseArgs } from "node:util";
import pc from "picocolors";
import { executeScan, type FailOn, type RulePolicyEntry, type RulePolicySeverity, type Severity } from "./engine.ts";
import { isFailOn, isRulePolicySeverity, isSeverity, toRulePolicyEntries } from "./scan/config.ts";
import type { RulePolicy } from "./scan/types.ts";
import type { Diagnostic } from "./rules/types.ts";

interface UnguardConfig {
  paths?: string[];
  ignore?: string[];
  rules?: RulePolicy;
  failOn?: FailOn;
  severity?: Severity[];
}

// @unguard unused-export CLI entry point
export async function main(argv: string[]): Promise<number> {
  const rawArgs = argv.slice(2);
  const userArgs = rawArgs[0] === "scan" ? rawArgs.slice(1) : rawArgs;

  const { values, positionals: cliPaths } = parseArgs({
    args: userArgs,
    options: {
      strict: { type: "boolean", default: false },
      filter: { type: "string" },
      format: { type: "string", default: "grouped" },
      severity: { type: "string", multiple: true, default: [] },
      ignore: { type: "string", multiple: true, default: [] },
      rule: { type: "string", multiple: true, default: [] },
      config: { type: "string" },
      "fail-on": { type: "string" },
      help: { type: "boolean", short: "h", default: false },
    },
    allowPositionals: true,
  });

  if (values.help) {
    printHelp();
    return 0;
  }

  let config: UnguardConfig | null = null;
  try {
    const configPath = findConfigPath(values.config);
    config = configPath ? loadConfig(configPath) : null;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(pc.red(message));
    return 1;
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

  const failOnResult = resolveFailOn(values["fail-on"], config?.failOn);
  if (!failOnResult.ok) {
    console.error(pc.red(failOnResult.message));
    return 1;
  }

  const paths = cliPaths.length > 0 ? cliPaths : config?.paths ?? [];
  const ignore = [...(config?.ignore ?? []), ...values.ignore];
  const rulePolicy = [
    ...toRulePolicyEntries(config?.rules),
    ...rulePolicyResult.value,
  ];

  const execution = await executeScan({
    paths,
    strict: values.strict,
    rules: values.filter ? [values.filter] : undefined,
    ignore: ignore.length > 0 ? ignore : undefined,
    rulePolicy: rulePolicy.length > 0 ? rulePolicy : undefined,
    showSeverities: severityFiltersResult.value.length > 0 ? severityFiltersResult.value : config?.severity,
    failOn: failOnResult.value,
  });

  const diagnostics = execution.visibleDiagnostics;
  if (diagnostics.length === 0) {
    console.log(pc.green(`No issues found in ${execution.fileCount} files.`));
    return execution.exitCode;
  }

  if (values.format === "flat") {
    printDiagnosticsFlat(diagnostics);
  } else {
    printDiagnostics(diagnostics);
  }
  printSummary(diagnostics, execution.fileCount);

  return execution.exitCode;
}

function printHelp() {
  console.log(`unguard: data-shape static analyzer

Usage:
  unguard scan [paths...] [options]
  unguard [paths...] [options]

Options:
  --config <path>       Path to unguard config file (defaults to ./unguard.config.json)
  --strict              Treat all diagnostics as errors
  --filter <rule>       Run only the specified rule
  --rule <sel=sev>      Override rule severity (supports id, *, category:<name>, tag:<name>)
  --ignore <glob>       Ignore path glob. Repeatable.
  --severity <levels>   Filter output by severity (comma-separated and/or repeatable)
  --fail-on <level>     Exit threshold: none, error, warning, info (default: info)
  --format <mode>       Output format: grouped (default) or flat
  -h, --help            Show this help

Exit codes:
  0  Clean, or does not meet --fail-on threshold
  1  Meets threshold without errors
  2  Meets threshold with at least one error

Examples:
  unguard scan src
  unguard scan src --rule duplicate-*=warning
  unguard scan src --rule category:cross-file=warning
  unguard scan src --rule tag:safety=error
  unguard scan src --severity=error,warning
  unguard scan src --fail-on=error`);
}

function printDiagnostics(diagnostics: Diagnostic[]) {
  const byFile = new Map<string, Diagnostic[]>();
  for (const diagnostic of diagnostics) {
    let list = byFile.get(diagnostic.file);
    if (list === undefined) {
      list = [];
      byFile.set(diagnostic.file, list);
    }
    list.push(diagnostic);
  }

  const cwd = `${process.cwd()}/`;
  const cwdBase = process.cwd();

  for (const [file, fileDiagnostics] of byFile) {
    const rel = relative(cwdBase, file);
    console.log(pc.underline(rel));

    for (const diagnostic of fileDiagnostics) {
      const loc = `${diagnostic.line}:${diagnostic.column}`;
      const sev = diagnostic.severity === "error"
        ? pc.red("error")
        : diagnostic.severity === "warning"
        ? pc.yellow("warning")
        : pc.blue("info");
      const msg = diagnostic.message.replaceAll(cwd, "");
      const rule = pc.dim(diagnostic.ruleId);
      const annotation = diagnostic.annotation !== undefined ? `  ${pc.cyan(diagnostic.annotation)}` : "";
      console.log(`  ${pc.dim(loc.padEnd(10))} ${sev}  ${msg}  ${rule}${annotation}`);
    }

    console.log();
  }
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
    `\n${pc.bold(String(diagnostics.length))} issue${diagnostics.length === 1 ? "" : "s"} in ${fileCount} files.`,
  );
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
    config.severity = raw.severity as Severity[];
  }

  if (raw.rules !== undefined) {
    if (typeof raw.rules !== "object" || raw.rules === null || Array.isArray(raw.rules)) {
      throw new Error(`Invalid config in ${basename(path)}: "rules" must be an object.`);
    }

    const rules: Record<string, RulePolicySeverity> = {};
    for (const [selector, severity] of Object.entries(raw.rules as Record<string, unknown>)) {
      if (typeof severity !== "string" || !isRulePolicySeverity(severity)) {
        throw new Error(`Invalid config in ${basename(path)}: rule "${selector}" must be off, info, warning, or error.`);
      }
      rules[selector] = severity;
    }
    config.rules = rules;
  }

  return config;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}

function resolveFailOn(
  cliValue: string | undefined,
  configValue: FailOn | undefined,
): { ok: true; value: FailOn } | { ok: false; message: string } {
  const selected = cliValue ?? configValue ?? "info";
  if (!isFailOn(selected)) {
    return { ok: false, message: `Invalid --fail-on value "${selected}". Use none, error, warning, or info.` };
  }
  return { ok: true, value: selected };
}
