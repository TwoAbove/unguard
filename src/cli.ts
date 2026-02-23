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
  console.log(
    `\n${pc.bold(String(result.diagnostics.length))} issue${result.diagnostics.length === 1 ? "" : "s"} in ${result.fileCount} files.`,
  );

  return result.diagnostics.some((d) => d.severity === "error") ? 1 : 0;
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

  for (const [file, diags] of byFile) {
    for (const d of diags) {
      const sev = d.severity === "error" ? pc.red("error") : pc.yellow("warning");
      const annotation = d.annotation !== undefined ? ` ${pc.cyan(`(${d.annotation})`)}` : "";
      console.log(`${pc.dim(file)}:${d.line}:${d.column} ${sev} ${d.message} ${pc.dim(`[${d.ruleId}]`)}${annotation}`);
    }
  }
}
