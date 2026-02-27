import fg from "fast-glob";
import ignore from "ignore";
import { existsSync, readFileSync } from "node:fs";
import { relative, resolve, sep } from "node:path";
import type { ResolvedScanConfig } from "./types.ts";

export async function discoverFiles(config: ResolvedScanConfig): Promise<string[]> {
  const globs = expandGlobs(config.paths);
  const discoveredFiles = await fg(globs, {
    ignore: config.ignore,
    absolute: true,
  });
  if (!config.useGitIgnore) return discoveredFiles;
  return applyGitIgnore(discoveredFiles);
}

function expandGlobs(paths: string[]): string[] {
  return paths.map((p) => {
    if (p === ".") return "./**/*.{ts,cts,mts,tsx}";
    if (p.endsWith("/")) return `${p}**/*.{ts,cts,mts,tsx}`;
    if (!p.includes("*") && !p.endsWith(".ts") && !p.endsWith(".tsx") && !p.endsWith(".cts") && !p.endsWith(".mts")) {
      return `${p}/**/*.{ts,cts,mts,tsx}`;
    }
    return p;
  });
}

function applyGitIgnore(files: string[]): string[] {
  const gitIgnorePath = resolve(process.cwd(), ".gitignore");
  if (!existsSync(gitIgnorePath)) return files;

  const matcher = ignore().add(readFileSync(gitIgnorePath, "utf8"));
  return files.filter((file) => {
    const rel = relative(process.cwd(), file);
    if (rel.startsWith("..")) return true;
    const normalized = rel.split(sep).join("/");
    return !matcher.ignores(normalized);
  });
}
