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
  return collectProject(program).index;
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
    const [firstDuplicateGroup] = dupes;
    expect(firstDuplicateGroup).toBeDefined();
    expect(firstDuplicateGroup?.length).toBe(2);
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

  it("collects function expressions", () => {
    const index = collect({
      "a.ts": "const add = function(a: number, b: number) { return a + b; };",
    });
    expect(index.functions.getByName("add")).toHaveLength(1);
  });

  it("collects class methods", () => {
    const index = collect({
      "a.ts": "class Calculator { add(a: number, b: number) { return a + b; } }",
    });
    expect(index.functions.getByName("Calculator.add")).toHaveLength(1);
  });

  it("collects object property arrow functions", () => {
    const index = collect({
      "a.ts": "const obj = { add: (a: number, b: number) => a + b };",
    });
    expect(index.functions.getByName("add")).toHaveLength(1);
  });

  it("collects object property function expressions", () => {
    const index = collect({
      "a.ts": "const obj = { add: function(a: number, b: number) { return a + b; } };",
    });
    expect(index.functions.getByName("add")).toHaveLength(1);
  });

  it("tracks optional params", () => {
    const index = collect({
      "a.ts": "function greet(name: string, greeting?: string) { return greeting + name; }",
    });
    const fns = index.functions.getByName("greet");
    expect(fns).toHaveLength(1);
    const [greetFn] = fns;
    expect(greetFn).toBeDefined();
    expect(greetFn?.params).toHaveLength(2);
    expect(greetFn?.params[1]?.optional).toBe(true);
  });
});

describe("ConstantRegistry", () => {
  it("detects duplicate constant values across files", () => {
    const index = collect({
      "a.ts": 'const TIMEOUT = 3000;',
      "b.ts": 'const DELAY = 3000;',
    });
    const dupes = index.constants.getDuplicateGroups();
    expect(dupes.length).toBeGreaterThan(0);
    const [firstGroup] = dupes;
    expect(firstGroup).toBeDefined();
    expect(firstGroup?.length).toBe(2);
  });

  it("does not flag different constant values", () => {
    const index = collect({
      "a.ts": 'const TIMEOUT = 3000;',
      "b.ts": 'const DELAY = 5000;',
    });
    expect(index.constants.getDuplicateGroups()).toHaveLength(0);
  });

  it("collects string literals", () => {
    const index = collect({
      "a.ts": 'const URL = "https://example.com";',
    });
    expect(index.constants.getAll()).toHaveLength(1);
    expect(index.constants.getAll()[0]?.valueText).toBe('"https://example.com"');
  });

  it("collects negative numbers", () => {
    const index = collect({
      "a.ts": "const NEG = -1;",
    });
    expect(index.constants.getAll()).toHaveLength(1);
  });

  it("collects binary expressions of literals", () => {
    const index = collect({
      "a.ts": "const HOURS = 6 * 60 * 60;",
    });
    expect(index.constants.getAll()).toHaveLength(1);
  });

  it("skips arrow functions", () => {
    const index = collect({
      "a.ts": "const fn = () => 42;",
    });
    expect(index.constants.getAll()).toHaveLength(0);
  });

  it("skips object literals", () => {
    const index = collect({
      "a.ts": "const obj = { x: 1 };",
    });
    expect(index.constants.getAll()).toHaveLength(0);
  });

  it("skips call expressions", () => {
    const index = collect({
      "a.ts": "const val = someFunc();",
    });
    expect(index.constants.getAll()).toHaveLength(0);
  });
});

describe("AnonymousFunctions", () => {
  it("collects anonymous arrow function passed as call argument", () => {
    const index = collect({
      "a.ts": `
        declare function register(cb: (x: string) => string): void;
        register((input: string) => {
          const trimmed = input.trim();
          const lower = trimmed.toLowerCase();
          return lower.replace(/\\s+/g, "-") + trimmed;
        });
      `,
    });
    const fns = index.functions.getAll().filter((f) => f.name.startsWith("register."));
    expect(fns).toHaveLength(1);
    expect(fns[0]?.name).toBe("register.$arg0");
  });

  it("skips small anonymous functions", () => {
    const index = collect({
      "a.ts": `
        declare const items: number[];
        items.map((x) => x + 1);
      `,
    });
    const fns = index.functions.getAll().filter((f) => f.name.includes("map."));
    expect(fns).toHaveLength(0);
  });

  it("does not double-collect named arrow functions", () => {
    const index = collect({
      "a.ts": "const add = (a: number, b: number) => { return a + b; };",
    });
    expect(index.functions.getByName("add")).toHaveLength(1);
  });

  it("derives name from grandparent PropertyAssignment", () => {
    const index = collect({
      "a.ts": `
        declare function createEffect(opts: Record<string, (x: string) => string>): void;
        const obj = {
          handler: createEffect((input: string) => {
            const trimmed = input.trim();
            const lower = trimmed.toLowerCase();
            return lower.replace(/\\s+/g, "-") + trimmed;
          }),
        };
      `,
    });
    // The grandparent is PropertyAssignment "handler"
    // But createEffect is the parent call — grandparent is PropertyAssignment
    const fns = index.functions.getAll().filter((f) => f.name === "handler");
    expect(fns).toHaveLength(1);
  });
});

describe("NearDuplicates", () => {
  it("groups near-duplicates by normalized hash", () => {
    const index = collect({
      "a.ts": 'function greetEn(name: string) { return "Hello " + name; }',
      "b.ts": 'function greetEs(name: string) { return "Hola " + name; }',
    });
    expect(index.functions.getNearDuplicateGroups().length).toBeGreaterThan(0);
    // But exact duplicates should NOT appear in near-duplicate groups
    expect(index.functions.getDuplicateGroups()).toHaveLength(0);
  });
});

describe("CallSites", () => {
  it("collects call sites with arg counts", () => {
    const index = collect({
      "a.ts": 'greet("Alice", "Hi");\ngreet("Bob");',
    });
    const greetCalls = index.callSites.filter((c) => c.calleeName === "greet");
    expect(greetCalls).toHaveLength(2);
    const [firstCall, secondCall] = greetCalls;
    expect(firstCall).toBeDefined();
    expect(secondCall).toBeDefined();
    expect(firstCall?.argCount).toBe(2);
    expect(secondCall?.argCount).toBe(1);
  });

  it("collects method call sites", () => {
    const index = collect({
      "a.ts": "obj.method(1, 2, 3);",
    });
    const methodCalls = index.callSites.filter((c) => c.calleeName === "method");
    expect(methodCalls).toHaveLength(1);
    const [methodCall] = methodCalls;
    expect(methodCall).toBeDefined();
    expect(methodCall?.argCount).toBe(3);
  });
});
