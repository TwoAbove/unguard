import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import * as ts from "typescript";
import { describe, expect, it } from "vitest";
import { scan } from "../src/engine.ts";
import {
  createProgramForGroup,
  groupFilesByTsconfig,
  mergeCompatibleGroups,
} from "../src/typecheck/program.ts";

function fixture(root: string, files: Record<string, string>): void {
  for (const [name, contents] of Object.entries(files)) {
    const path = join(root, name);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, contents);
  }
}

const options = { module: "ESNext", moduleResolution: "Bundler", strict: true };

function importedFile(program: ts.Program, file: string): string | undefined {
  const source = program.getSourceFile(file);
  if (!source) throw new Error(`Missing source file: ${file}`);
  const declaration = source.statements.find(ts.isImportDeclaration);
  if (!declaration) throw new Error(`Missing import: ${file}`);
  return program.getTypeChecker().getSymbolAtLocation(declaration.moduleSpecifier)
    ?.declarations?.[0]?.getSourceFile().fileName;
}

describe("program group compatibility", () => {
  it("preserves module suffix precedence and export usage in each project", async () => {
    const root = mkdtempSync(join(tmpdir(), "unguard-program-suffixes-"));
    try {
      fixture(root, {
        "plain/tsconfig.json": JSON.stringify({ compilerOptions: { ...options, moduleSuffixes: ["", ".native"] } }),
        "native/tsconfig.json": JSON.stringify({ compilerOptions: { ...options, moduleSuffixes: [".native", ""] } }),
        "plain/main.ts": 'import { value } from "./library"; console.log(value);',
        "native/main.ts": 'import { value } from "./library"; console.log(value);',
        "plain/library.ts": "export const value = 1;",
        "plain/library.native.ts": "export const value = 2;",
        "native/library.ts": "export const value = 3;",
        "native/library.native.ts": "export const value = 4;",
      });
      const files = ["plain/main.ts", "plain/library.ts", "native/main.ts", "native/library.native.ts"]
        .map((file) => join(root, file));
      const groups = mergeCompatibleGroups(groupFilesByTsconfig(files));
      expect(groups).toHaveLength(2);
      for (const group of groups) {
        const program = createProgramForGroup(group, {});
        const directory = dirname(group.scanFiles[0]!);
        const expected = directory === join(root, "plain") ? "library.ts" : "library.native.ts";
        expect(importedFile(program, join(directory, "main.ts"))).toBe(join(directory, expected));
      }
      const result = await scan({ paths: files, rules: ["unused-export"], cache: false });
      expect(result.diagnostics).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("merges equivalent options regardless of top-level order and overridden skipLibCheck", () => {
    const root = mkdtempSync(join(tmpdir(), "unguard-program-equivalent-"));
    try {
      fixture(root, {
        "a/tsconfig.json": JSON.stringify({ compilerOptions: {
          ...options, baseUrl: root, paths: { shared: ["shared.ts"], other: ["other.ts"] }, skipLibCheck: false,
        } }),
        "b/tsconfig.json": JSON.stringify({ compilerOptions: {
          skipLibCheck: true, paths: { shared: ["shared.ts"], other: ["other.ts"] }, baseUrl: root,
          strict: true, moduleResolution: "Bundler", module: "ESNext",
        } }),
        "a/main.ts": 'import { value } from "shared"; console.log(value);',
        "b/main.ts": 'import { value } from "shared"; console.log(value);',
        "shared.ts": "export const value = 1;",
        "other.ts": "export const other = 2;",
      });
      const files = [join(root, "a/main.ts"), join(root, "b/main.ts")];
      const groups = mergeCompatibleGroups(groupFilesByTsconfig(files));
      expect(groups).toHaveLength(1);
      const program = createProgramForGroup(groups[0]!, {});
      for (const file of files) expect(importedFile(program, file)).toBe(join(root, "shared.ts"));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("preserves insertion-order precedence for equal-prefix wildcard paths", () => {
    const root = mkdtempSync(join(tmpdir(), "unguard-program-path-order-"));
    try {
      fixture(root, {
        "a/tsconfig.json": JSON.stringify({ compilerOptions: {
          ...options, baseUrl: root, paths: { "foo*": ["first.ts"], "foo*b": ["second.ts"] },
        } }),
        "b/tsconfig.json": JSON.stringify({ compilerOptions: {
          ...options, baseUrl: root, paths: { "foo*b": ["second.ts"], "foo*": ["first.ts"] },
        } }),
        "a/main.ts": 'import { value } from "foob"; console.log(value);',
        "b/main.ts": 'import { value } from "foob"; console.log(value);',
        "first.ts": "export const value = 1;",
        "second.ts": "export const value = 2;",
      });
      const groups = mergeCompatibleGroups(groupFilesByTsconfig([join(root, "a/main.ts"), join(root, "b/main.ts")]));
      expect(groups).toHaveLength(2);
      for (const group of groups) {
        const file = group.scanFiles[0]!;
        const expected = dirname(file) === join(root, "a") ? "first.ts" : "second.ts";
        expect(importedFile(createProgramForGroup(group, {}), file)).toBe(join(root, expected));
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("keeps identical relative path mappings anchored to their own config", () => {
    const root = mkdtempSync(join(tmpdir(), "unguard-program-paths-"));
    try {
      const config = JSON.stringify({ compilerOptions: { ...options, paths: { shared: ["./library.ts"] } } });
      fixture(root, {
        "a/tsconfig.json": config,
        "b/tsconfig.json": config,
        "a/main.ts": 'import { value } from "shared"; console.log(value);',
        "b/main.ts": 'import { value } from "shared"; console.log(value);',
        "a/library.ts": "export const value = 1;",
        "b/library.ts": "export const value = 2;",
      });
      const groups = mergeCompatibleGroups(groupFilesByTsconfig([join(root, "a/main.ts"), join(root, "b/main.ts")]));
      expect(groups).toHaveLength(2);
      for (const group of groups) {
        const file = group.scanFiles[0]!;
        expect(importedFile(createProgramForGroup(group, {}), file)).toBe(join(dirname(file), "library.ts"));
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
