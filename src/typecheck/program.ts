import * as ts from "typescript";
import { dirname } from "node:path";

export function createProgramFromFiles(files: string[]): ts.Program {
  let configPath: string | undefined;
  if (files.length > 0) {
    configPath = ts.findConfigFile(dirname(files[0] as string), ts.sys.fileExists, "tsconfig.json");
  }

  if (configPath) {
    const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
    const parsed = ts.parseJsonConfigFileContent(configFile.config, ts.sys, dirname(configPath));
    return ts.createProgram({
      rootNames: files,
      options: { ...parsed.options, skipLibCheck: true },
    });
  }

  return ts.createProgram({
    rootNames: files,
    options: {
      target: ts.ScriptTarget.ESNext,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      strict: true,
      skipLibCheck: true,
      noEmit: true,
    },
  });
}
