import { relative } from "node:path";
import pc from "picocolors";
import { scan } from "./engine.ts";
import type { Diagnostic } from "./rules/types.ts";

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
  const paths = userArgs.filter((a) => !a.startsWith("--"));

  const result = await scan({
    paths,
    strict,
    rules: filter ? [filter] : undefined,
  });

  if (result.diagnostics.length === 0) {
    console.log(pc.green(`No issues found in ${result.fileCount} files.`));
    return 0;
  }

  printDiagnostics(result.diagnostics);
  printSummary(result.diagnostics, result.fileCount);

  const filesWithErrors = new Set(
    result.diagnostics.filter((d) => d.severity === "error").map((d) => d.file),
  ).size;
  return filesWithErrors;
}

function printHelp() {
  console.log(`unguard: data-shape static analyzer

Usage:
  unguard scan [paths...] [options]
  unguard [paths...] [options]

Options:
  --strict          Treat all warnings as errors
  --filter <rule>   Run only the specified rule
  -h, --help        Show this help

Examples:
  unguard scan src
  unguard scan src --strict
  unguard scan src --filter no-empty-catch`);
}

function extractFlag(args: string[], flag: string): string | undefined {
  const idx = args.indexOf(flag);
  if (idx === -1) return undefined;
  const value = args[idx + 1];
  args.splice(idx, 2);
  return value;
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
