import { describe, it, expect, afterAll } from "vitest";
import { collectProject } from "../../src/collect/index.ts";
import { createProgramFromFiles } from "../../src/typecheck/program.ts";
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const tmp = join(tmpdir(), "unguard-test-collect");

function setup(files: Record<string, string>): string[] {
  rmSync(tmp, { recursive: true, force: true });
  mkdirSync(tmp, { recursive: true });
  const paths: string[] = [];
  for (const [name, content] of Object.entries(files)) {
    const p = join(tmp, name);
    writeFileSync(p, content);
    paths.push(p);
  }
  return paths;
}

function collect(files: Record<string, string>) {
  const paths = setup(files);
  const program = createProgramFromFiles(paths);
  return collectProject(program);
}

afterAll(() => {
  rmSync(tmp, { recursive: true, force: true });
});

describe("TypeRegistry", () => {
  it("detects duplicate type shapes across files", () => {
    const index = collect({
      "a.ts": "type Point = { x: number; y: number };",
      "b.ts": "interface Coord { x: number; y: number }",
    });
    const dupes = index.types.getDuplicateGroups();
    expect(dupes.length).toBeGreaterThan(0);
    expect(dupes[0]!.length).toBe(2);
  });

  it("does not flag different type shapes", () => {
    const index = collect({
      "a.ts": "type Point = { x: number; y: number };",
      "b.ts": "type Rect = { width: number; height: number };",
    });
    expect(index.types.getDuplicateGroups()).toHaveLength(0);
  });

  it("handles optional properties in hashing", () => {
    const index = collect({
      "a.ts": "type A = { x: number; y?: string };",
      "b.ts": "type B = { x: number; y: string };",
    });
    // y optional vs required -> different hashes
    expect(index.types.getDuplicateGroups()).toHaveLength(0);
  });
});

describe("FunctionRegistry", () => {
  it("detects duplicate functions across files", () => {
    const index = collect({
      "a.ts": "function add(a: number, b: number) { return a + b; }",
      "b.ts": "function sum(a: number, b: number) { return a + b; }",
    });
    const dupes = index.functions.getDuplicateGroups();
    expect(dupes.length).toBeGreaterThan(0);
  });

  it("does not flag different functions", () => {
    const index = collect({
      "a.ts": "function add(a: number, b: number) { return a + b; }",
      "b.ts": "function sub(a: number, b: number) { return a - b; }",
    });
    expect(index.functions.getDuplicateGroups()).toHaveLength(0);
  });

  it("collects arrow functions", () => {
    const index = collect({
      "a.ts": "const add = (a: number, b: number) => a + b;",
    });
    expect(index.functions.getByName("add")).toHaveLength(1);
  });

  it("tracks optional params", () => {
    const index = collect({
      "a.ts": "function greet(name: string, greeting?: string) { return greeting + name; }",
    });
    const fns = index.functions.getByName("greet");
    expect(fns).toHaveLength(1);
    expect(fns[0]!.params).toHaveLength(2);
    expect(fns[0]!.params[1]!.optional).toBe(true);
  });
});

describe("CallSites", () => {
  it("collects call sites with arg counts", () => {
    const index = collect({
      "a.ts": 'greet("Alice", "Hi");\ngreet("Bob");',
    });
    const greetCalls = index.callSites.filter((c) => c.calleeName === "greet");
    expect(greetCalls).toHaveLength(2);
    expect(greetCalls[0]!.argCount).toBe(2);
    expect(greetCalls[1]!.argCount).toBe(1);
  });

  it("collects method call sites", () => {
    const index = collect({
      "a.ts": "obj.method(1, 2, 3);",
    });
    const methodCalls = index.callSites.filter((c) => c.calleeName === "method");
    expect(methodCalls).toHaveLength(1);
    expect(methodCalls[0]!.argCount).toBe(3);
  });
});
