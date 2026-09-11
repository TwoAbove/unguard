import { mkdtempSync, mkdirSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { scan } from "../src/engine.ts";

async function withProject(run: (root: string, put: (file: string, text: string) => void) => Promise<void>) {
  const cwd = process.cwd();
  const root = realpathSync(mkdtempSync(join(tmpdir(), "unguard-cache-inputs-")));
  const put = (file: string, text: string) => {
    const path = join(root, file);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, text);
  };
  mkdirSync(join(root, "node_modules"));
  process.chdir(root);
  try {
    await run(root, put);
  } finally {
    process.chdir(cwd);
    rmSync(root, { recursive: true, force: true });
  }
}

const config = JSON.stringify({ compilerOptions: { strict: true, module: "ESNext", moduleResolution: "Bundler" }, include: ["*.ts"] });

describe("cache semantic inputs", () => {
  const concurrency = 1;

  it("invalidates reportability when gitignore changes but project inputs do not", async () => {
    await withProject(async (root, put) => {
      put("tsconfig.json", config);
      put("library.ts", "export const value = 1;\n");
      put("other.ts", "export {};\n");
      const options = { paths: [root], rules: ["unused-export"], cache: true, concurrency };
      const first = await scan(options);
      expect(first.fileCount).toBe(2);
      expect(first.diagnostics).toMatchObject([{ ruleId: "unused-export", file: join(root, "library.ts") }]);
      put(".gitignore", "library.ts\n");
      const hidden = await scan(options);
      expect(hidden.fileCount).toBe(1);
      expect(hidden.diagnostics).toEqual([]);
      put(".gitignore", "");
      const visible = await scan(options);
      expect(visible.fileCount).toBe(2);
      expect(visible.diagnostics).toMatchObject([{ ruleId: "unused-export", file: join(root, "library.ts") }]);
    });
  });

  it("invalidates when unscanned callers change, appear, and disappear", async () => {
    await withProject(async (root, put) => {
      put("one/tsconfig.json", config);
      put("one/lib.ts", "export function value() { return 1; }\n");
      put("one/use.ts", 'import { value } from "./lib"; value();\n');
      const options = { paths: [join(root, "one/lib.ts")], rules: ["unused-export"], cache: true, concurrency };
      expect((await scan(options)).diagnostics).toEqual([]);
      put("one/use.ts", "export {};\n");
      expect((await scan(options)).diagnostics).toMatchObject([{ ruleId: "unused-export", file: join(root, "one/lib.ts") }]);
      put("one/added.ts", 'import { value } from "./lib"; value();\n');
      expect((await scan(options)).diagnostics).toEqual([]);
      rmSync(join(root, "one/added.ts"));
      expect((await scan(options)).diagnostics).toMatchObject([{ ruleId: "unused-export", file: join(root, "one/lib.ts") }]);
    });
  });

  it("tracks imported declarations outside expanded project roots", async () => {
    await withProject(async (root, put) => {
      put("tsconfig.json", JSON.stringify({ compilerOptions: { strict: true }, files: ["entry.ts"] }));
      put("entry.ts", 'import { value } from "./types/context"; const result = value ?? "fallback";\n');
      put("types/context.d.ts", "export declare const value: string | undefined;\n");
      const options = { paths: [join(root, "entry.ts")], rules: ["no-nullish-coalescing"], cache: true, concurrency };
      expect((await scan(options)).diagnostics).toEqual([]);
      put("types/context.d.ts", "export declare const value: string;\n");
      expect((await scan(options)).diagnostics).toMatchObject([{ ruleId: "no-nullish-coalescing" }]);
      put("types/context.d.ts", "export declare const value: string | undefined;\n");
      expect((await scan(options)).diagnostics).toEqual([]);
    });
  });

  it("tracks direct and inherited compiler options", async () => {
    await withProject(async (root, put) => {
      put("base.json", JSON.stringify({ compilerOptions: { strict: true, noUncheckedIndexedAccess: true }, include: ["entry.ts"] }));
      put("tsconfig.json", JSON.stringify({ extends: "./base.json" }));
      put("entry.ts", 'declare const values: string[]; function readValue(index: number) { return values[index]; } const result = readValue(0) ?? "fallback";\n');
      const options = { paths: [join(root, "entry.ts")], rules: ["no-nullish-coalescing"], cache: true, concurrency };
      expect((await scan(options)).diagnostics).toEqual([]);
      put("base.json", JSON.stringify({ compilerOptions: { strict: true, noUncheckedIndexedAccess: false }, include: ["entry.ts"] }));
      expect((await scan(options)).diagnostics).toMatchObject([{ ruleId: "no-nullish-coalescing" }]);
      put("tsconfig.json", JSON.stringify({ extends: "./base.json", compilerOptions: { noUncheckedIndexedAccess: true } }));
      expect((await scan(options)).diagnostics).toEqual([]);
    });
  });

  it("refreshes include patterns in an extended config", async () => {
    await withProject(async (root, put) => {
      put("base.json", JSON.stringify({ compilerOptions: { strict: true }, include: ["lib.ts"] }));
      put("tsconfig.json", JSON.stringify({ extends: "./base.json" }));
      put("lib.ts", "export function value() { return 1; }\n");
      put("context/use.ts", 'import { value } from "../lib"; value();\n');
      const options = { paths: [join(root, "lib.ts")], rules: ["unused-export"], cache: true, concurrency };
      expect((await scan(options)).diagnostics).toMatchObject([{ ruleId: "unused-export" }]);
      put("base.json", JSON.stringify({ compilerOptions: { strict: true }, include: ["**/*.ts"] }));
      expect((await scan(options)).diagnostics).toEqual([]);
    });
  });

  it("refreshes package metadata used by module resolution", async () => {
    await withProject(async (root, put) => {
      put("tsconfig.json", JSON.stringify({ compilerOptions: { strict: true, module: "NodeNext", moduleResolution: "NodeNext" }, files: ["entry.ts"] }));
      put("package.json", JSON.stringify({ type: "module" }));
      put("entry.ts", 'import { value } from "dependency"; const result = value ?? "fallback";\n');
      put("node_modules/dependency/package.json", JSON.stringify({ exports: { import: "./esm.d.ts", require: "./cjs.d.ts" } }));
      put("node_modules/dependency/esm.d.ts", "export declare const value: string | undefined;\n");
      put("node_modules/dependency/cjs.d.ts", "export declare const value: string;\n");
      const options = { paths: [join(root, "entry.ts")], rules: ["no-nullish-coalescing"], cache: true, concurrency };
      expect((await scan(options)).diagnostics).toEqual([]);
      rmSync(join(root, "package.json"));
      expect((await scan(options)).diagnostics).toMatchObject([{ ruleId: "no-nullish-coalescing" }]);
      put("package.json", JSON.stringify({ type: "module" }));
      expect((await scan(options)).diagnostics).toEqual([]);
    });
  });
});
