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
  cache?: ProgramBuildCache;
}

export interface ProgramBuildCache {
  sourceFiles: Map<string, ts.SourceFile>;
  readFiles: Map<string, string | undefined>;
  fileExists: Map<string, boolean>;
  directoryExists: Map<string, boolean>;
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

export function createProgramBuildCache(): ProgramBuildCache {
  return {
    sourceFiles: new Map(),
    readFiles: new Map(),
    fileExists: new Map(),
    directoryExists: new Map(),
  };
}

function createProgramForConfig(
  files: string[],
  configPath: string | undefined,
  cache: ProgramBuildCache | undefined,
): ts.Program {
  if (configPath) {
    const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
    const parsed = ts.parseJsonConfigFileContent(configFile.config, ts.sys, dirname(configPath));
    const options = { ...parsed.options, skipLibCheck: true };
    return ts.createProgram({
      rootNames: files,
      options,
      host: maybeCachedCompilerHost(options, cache),
    });
  }
  return ts.createProgram({
    rootNames: files,
    options: defaultOptions,
    host: maybeCachedCompilerHost(defaultOptions, cache),
  });
}

function maybeCachedCompilerHost(
  options: ts.CompilerOptions,
  cache: ProgramBuildCache | undefined,
): ts.CompilerHost | undefined {
  if (cache === undefined) return undefined;
  return createCachedCompilerHost(options, cache);
}

function createCachedCompilerHost(
  options: ts.CompilerOptions,
  cache: ProgramBuildCache,
): ts.CompilerHost {
  const host = ts.createCompilerHost(options);
  const baseGetSourceFile = host.getSourceFile.bind(host);
  const baseReadFile = host.readFile.bind(host);
  const baseFileExists = host.fileExists.bind(host);
  const baseDirectoryExists = host.directoryExists?.bind(host);

  function cacheKey(fileName: string): string {
    return host.getCanonicalFileName(ts.sys.resolvePath(fileName));
  }

  host.readFile = (fileName) => {
    const key = cacheKey(fileName);
    if (cache.readFiles.has(key)) return cache.readFiles.get(key);
    const text = baseReadFile(fileName);
    cache.readFiles.set(key, text);
    return text;
  };

  host.fileExists = (fileName) => {
    const key = cacheKey(fileName);
    const cached = cache.fileExists.get(key);
    if (cached !== undefined) return cached;
    const exists = baseFileExists(fileName);
    cache.fileExists.set(key, exists);
    return exists;
  };

  if (baseDirectoryExists !== undefined) {
    host.directoryExists = (directoryName) => {
      const key = cacheKey(directoryName);
      const cached = cache.directoryExists.get(key);
      if (cached !== undefined) return cached;
      const exists = baseDirectoryExists(directoryName);
      cache.directoryExists.set(key, exists);
      return exists;
    };
  }

  host.getSourceFile = (
    fileName,
    languageVersionOrOptions,
    onError,
    shouldCreateNewSourceFile,
  ) => {
    if (!isStableCachedSourceFile(fileName)) {
      return baseGetSourceFile(fileName, languageVersionOrOptions, onError, shouldCreateNewSourceFile);
    }

    const key = sourceFileCacheKey(cacheKey(fileName), languageVersionOrOptions);
    if (!shouldCreateNewSourceFile) {
      const cached = cache.sourceFiles.get(key);
      if (cached !== undefined) return cached;
    }

    const sourceFile = baseGetSourceFile(fileName, languageVersionOrOptions, onError, shouldCreateNewSourceFile);
    if (sourceFile !== undefined) cache.sourceFiles.set(key, sourceFile);
    return sourceFile;
  };

  return host;
}

function isStableCachedSourceFile(fileName: string): boolean {
  const normalized = fileName.replaceAll("\\", "/");
  return normalized.includes("/node_modules/")
    || /\.d\.[cm]?ts$/.test(normalized)
    || normalized.endsWith(".json");
}

function sourceFileCacheKey(
  fileKey: string,
  languageVersionOrOptions: ts.ScriptTarget | ts.CreateSourceFileOptions,
): string {
  if (typeof languageVersionOrOptions !== "object") {
    return `${fileKey}\0${languageVersionOrOptions}\0\0`;
  }
  return `${fileKey}\0${languageVersionOrOptions.languageVersion}\0${languageVersionOrOptions.impliedNodeFormat ?? ""}\0${languageVersionOrOptions.jsDocParsingMode ?? ""}`;
}

export function expandProjectFiles(group: ProgramGroupConfig): string[] {
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

  return [...byKey.values()].flatMap((compatible) => {
    const primary = compatible[0];
    if (primary === undefined) return [];
    const rest = compatible.slice(1);
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
  return createProgramForConfig(rootFiles, group.configPath, options.cache);
}
