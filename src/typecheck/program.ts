import * as ts from "typescript";
import { dirname } from "node:path";

export interface ProgramGroup {
  program: ts.Program;
  scanFiles: string[];
}

export interface ProgramGroupConfig {
  configPath: string | undefined;
  scanFiles: string[];
  /** Additional tsconfig paths whose project files should be included when expanding. */
  expandConfigPaths?: string[];
}

export interface ProgramGroupOptions {
  expandProjectFiles?: boolean;
}

const defaultOptions: ts.CompilerOptions = {
  target: ts.ScriptTarget.ESNext,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  strict: true,
  skipLibCheck: true,
  noEmit: true,
};

function findTsconfig(file: string): string | undefined {
  return ts.findConfigFile(dirname(file), ts.sys.fileExists, "tsconfig.json");
}

function createProgramForConfig(files: string[], configPath: string | undefined): ts.Program {
  if (configPath) {
    const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
    const parsed = ts.parseJsonConfigFileContent(configFile.config, ts.sys, dirname(configPath));
    return ts.createProgram({
      rootNames: files,
      options: { ...parsed.options, skipLibCheck: true },
    });
  }
  return ts.createProgram({ rootNames: files, options: defaultOptions });
}

function expandProjectFiles(group: ProgramGroupConfig): string[] {
  const configs = [group.configPath, ...(group.expandConfigPaths ?? [])];
  const expanded = new Set(group.scanFiles);
  for (const cp of configs) {
    if (!cp) continue;
    const configFile = ts.readConfigFile(cp, ts.sys.readFile);
    const parsed = ts.parseJsonConfigFileContent(configFile.config, ts.sys, dirname(cp));
    for (const f of parsed.fileNames) expanded.add(f);
  }
  return [...expanded];
}

function effectiveOptionsKey(configPath: string | undefined): string {
  if (!configPath) return "\0default";
  const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
  const parsed = ts.parseJsonConfigFileContent(configFile.config, ts.sys, dirname(configPath));
  const o = parsed.options;
  return JSON.stringify({
    target: o.target,
    module: o.module,
    moduleResolution: o.moduleResolution,
    jsx: o.jsx,
    strict: o.strict,
    paths: o.paths,
    baseUrl: o.baseUrl,
    lib: o.lib,
    types: o.types,
    esModuleInterop: o.esModuleInterop,
  });
}

/** Merge groups whose tsconfigs produce identical effective compiler options. */
export function mergeCompatibleGroups(groups: ProgramGroupConfig[]): ProgramGroupConfig[] {
  if (groups.length <= 1) return groups;

  const byKey = new Map<string, ProgramGroupConfig[]>();
  for (const group of groups) {
    const key = effectiveOptionsKey(group.configPath);
    let list = byKey.get(key);
    if (!list) {
      list = [];
      byKey.set(key, list);
    }
    list.push(group);
  }

  return [...byKey.values()].map((compatible) => {
    const [primary, ...rest] = compatible;
    if (!primary) return compatible[0];
    if (rest.length === 0) return primary;
    return {
      configPath: primary.configPath,
      scanFiles: compatible.flatMap((g) => g.scanFiles),
      expandConfigPaths: rest
        .map((g) => g.configPath)
        .filter((cp): cp is string => cp !== undefined),
    };
  });
}

/** Group scan files by nearest tsconfig (metadata only, no program creation). */
export function groupFilesByTsconfig(scanFiles: string[]): ProgramGroupConfig[] {
  if (scanFiles.length === 0) return [];

  const groups = new Map<string | undefined, string[]>();
  for (const file of scanFiles) {
    const configPath = findTsconfig(file);
    let group = groups.get(configPath);
    if (!group) {
      group = [];
      groups.set(configPath, group);
    }
    group.push(file);
  }

  return [...groups.entries()].map(([configPath, files]) => ({ configPath, scanFiles: files }));
}

/** Create a ts.Program from a group config. */
export function createProgramForGroup(
  group: ProgramGroupConfig,
  options: ProgramGroupOptions,
): ts.Program {
  const rootFiles = options.expandProjectFiles
    ? expandProjectFiles(group)
    : group.scanFiles;
  return createProgramForConfig(rootFiles, group.configPath);
}
