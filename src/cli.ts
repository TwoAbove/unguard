import { relative } from "node:path";
import pc from "picocolors";
import { scan } from "./engine.ts";
import type { Diagnostic } from "./rules/types.ts";

type Severity = "info" | "warning" | "error";
const SEVERITY_RANK: Record<Severity, number> = { info: 0, warning: 1, error: 2 };

function isSeverity(value: string): value is Severity {
  return value === "info" || value === "warning" || value === "error";
}

export async function main(argv: string[]): Promise<number> {
  const args = argv.slice(2);
  const first = args[0];

  if (first === "-h" || first === "--help") {
    printHelp();
    return 0;
  }

  const userArgs = first === "scan" ? args.slice(1) : args;
  const strict = userArgs.includes("--strict");
  const filter = extractFlag(userArgs, "--filter");
  const format = extractFlag(userArgs, "--format", "grouped");
  const severityFilter = extractFlag(userArgs, "--severity");
  const paths = userArgs.filter((a) => !a.startsWith("--"));

  const result = await scan({
    paths,
    strict,
    rules: filter ? [filter] : undefined,
  });

  const minRank = severityFilter !== undefined && isSeverity(severityFilter) ? SEVERITY_RANK[severityFilter] : 0;
  const filtered = minRank > 0 ? result.diagnostics.filter((d) => SEVERITY_RANK[d.severity] >= minRank) : result.diagnostics;

  if (filtered.length === 0) {
    console.log(pc.green(`No issues found in ${result.fileCount} files.`));
    return 0;
  }

  if (format === "flat") {
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
  --severity <level>    Show only diagnostics at this level or above (error, warning, info)
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
  unguard scan src --format=flat | grep error`);
}

function extractFlag(args: string[], flag: string, fallback?: string): string | undefined {
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === undefined) continue;
    if (arg === flag) {
      const value = args[i + 1];
      args.splice(i, 2);
      return value;
    }
    if (arg.startsWith(flag + "=")) {
      const value = arg.slice(flag.length + 1);
      args.splice(i, 1);
      return value;
    }
  }
  return fallback;
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
