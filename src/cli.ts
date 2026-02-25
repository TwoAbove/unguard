import { parseArgs } from "node:util";
import { relative } from "node:path";
import pc from "picocolors";
import { scan } from "./engine.ts";
import type { Diagnostic } from "./rules/types.ts";

type Severity = "info" | "warning" | "error";
function isSeverity(value: string): value is Severity {
  return value === "info" || value === "warning" || value === "error";
}

export async function main(argv: string[]): Promise<number> {
  const rawArgs = argv.slice(2);
  const userArgs = rawArgs[0] === "scan" ? rawArgs.slice(1) : rawArgs;

  const { values, positionals: paths } = parseArgs({
    args: userArgs,
    options: {
      strict: { type: "boolean", default: false },
      filter: { type: "string" },
      format: { type: "string", default: "grouped" },
      severity: { type: "string", multiple: true, default: [] },
      help: { type: "boolean", short: "h", default: false },
    },
    allowPositionals: true,
  });

  if (values.help) {
    printHelp();
    return 0;
  }

  const result = await scan({
    paths,
    strict: values.strict,
    rules: values.filter ? [values.filter] : undefined,
  });

  const severitySet = values.severity.length > 0
    ? new Set(values.severity.filter(isSeverity))
    : null;
  const filtered = severitySet
    ? result.diagnostics.filter((d) => severitySet.has(d.severity))
    : result.diagnostics;

  if (filtered.length === 0) {
    console.log(pc.green(`No issues found in ${result.fileCount} files.`));
    return 0;
  }

  if (values.format === "flat") {
    printDiagnosticsFlat(filtered);
  } else {
    printDiagnostics(filtered);
  }
  printSummary(filtered, result.fileCount);

  const hasError = filtered.some((d) => d.severity === "error");
  return hasError ? 2 : 1;
}

function printHelp() {
  console.log(`unguard: data-shape static analyzer

Usage:
  unguard scan [paths...] [options]
  unguard [paths...] [options]

Options:
  --strict              Treat all warnings as errors
  --filter <rule>       Run only the specified rule
  --severity <level>    Filter by severity (error, warning, info). Repeatable.
  --format <mode>       Output format: grouped (default) or flat
  -h, --help            Show this help

Exit codes:
  0  No issues
  1  Warnings or info only
  2  At least one error

Examples:
  unguard scan src
  unguard scan src --strict
  unguard scan src --filter no-empty-catch
  unguard scan src --severity=error
  unguard scan src --severity=error --severity=warning
  unguard scan src --format=flat | grep error`);
}


function printDiagnostics(diagnostics: Diagnostic[]) {
  const byFile = new Map<string, Diagnostic[]>();
  for (const d of diagnostics) {
    let list = byFile.get(d.file);
    if (list === undefined) {
      list = [];
      byFile.set(d.file, list);
    }
    list.push(d);
  }

  const cwd = process.cwd() + "/";
  const cwdBase = process.cwd();

  for (const [file, diags] of byFile) {
    const rel = relative(cwdBase, file);
    console.log(pc.underline(rel));

    for (const d of diags) {
      const loc = `${d.line}:${d.column}`;
      const sev = d.severity === "error" ? pc.red("error") : d.severity === "warning" ? pc.yellow("warning") : pc.blue("info");
      const msg = d.message.replaceAll(cwd, "");
      const rule = pc.dim(d.ruleId);
      const annotation = d.annotation !== undefined ? `  ${pc.cyan(d.annotation)}` : "";
      console.log(`  ${pc.dim(loc.padEnd(10))} ${sev}  ${msg}  ${rule}${annotation}`);
    }

    console.log();
  }
}

function printDiagnosticsFlat(diagnostics: Diagnostic[]) {
  const cwdBase = process.cwd();
  const cwd = cwdBase + "/";

  for (const d of diagnostics) {
    const rel = relative(cwdBase, d.file);
    const msg = d.message.replaceAll(cwd, "");
    console.log(`${rel}:${d.line}:${d.column} ${d.severity} [${d.ruleId}] ${msg}`);
  }
}

function printSummary(diagnostics: Diagnostic[], fileCount: number) {
  const counts = new Map<string, number>();
  for (const d of diagnostics) {
    const prev = counts.get(d.ruleId);
    counts.set(d.ruleId, (prev === undefined ? 0 : prev) + 1);
  }

  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const maxRule = Math.max(...sorted.map(([r]) => r.length));

  console.log(pc.bold("Summary"));
  for (const [rule, count] of sorted) {
    console.log(`  ${rule.padEnd(maxRule)}  ${pc.bold(String(count))}`);
  }

  console.log(
    `\n${pc.bold(String(diagnostics.length))} issue${diagnostics.length === 1 ? "" : "s"} in ${fileCount} files.`,
  );
}
