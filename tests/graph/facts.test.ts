import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { buildGraph } from "../../src/graph/graph.ts";
import { createProgramForGroup, groupFilesByTsconfig } from "../../src/typecheck/program.ts";

const tmp = join(tmpdir(), "unguard-test-graph-facts");

function setup(files: Record<string, string>): string[] {
  rmSync(tmp, { recursive: true, force: true });
  mkdirSync(tmp, { recursive: true });
  const paths: string[] = [];
  for (const [name, content] of Object.entries(files)) {
    const path = join(tmp, name);
    writeFileSync(path, content);
    paths.push(path);
  }
  return paths;
}

function graphFor(files: Record<string, string>) {
  const paths = setup(files);
  const [group] = groupFilesByTsconfig(paths);
  if (group === undefined) throw new Error("No program group created");
  return buildGraph(createProgramForGroup(group, {}));
}

afterAll(() => {
  rmSync(tmp, { recursive: true, force: true });
});

describe("types", () => {
  it("detects duplicate type shapes across files", () => {
    const graph = graphFor({
      "a.ts": "type Point = { x: number; y: number };",
      "b.ts": "interface Coord { x: number; y: number }",
    });
    const dupes = graph.duplicateGroups("type");
    expect(dupes.length).toBeGreaterThan(0);
    const [firstDuplicateGroup] = dupes;
    expect(firstDuplicateGroup).toBeDefined();
    expect(firstDuplicateGroup).toHaveLength(2);
  });

  it("does not flag different type shapes", () => {
    const graph = graphFor({
      "a.ts": "type Point = { x: number; y: number };",
      "b.ts": "type Rect = { width: number; height: number };",
    });
    expect(graph.duplicateGroups("type")).toHaveLength(0);
  });

  it("handles optional properties in hashing", () => {
    const graph = graphFor({
      "a.ts": "type A = { x: number; y?: string };",
      "b.ts": "type B = { x: number; y: string };",
    });
    expect(graph.duplicateGroups("type")).toHaveLength(0);
  });
});

describe("functions", () => {
  it("detects duplicate functions across files", () => {
    const graph = graphFor({
      "a.ts": "function add(a: number, b: number) { return a + b; }",
      "b.ts": "function sum(a: number, b: number) { return a + b; }",
    });
    expect(graph.duplicateGroups("function").length).toBeGreaterThan(0);
  });

  it("does not flag different functions", () => {
    const graph = graphFor({
      "a.ts": "function add(a: number, b: number) { return a + b; }",
      "b.ts": "function sub(a: number, b: number) { return a - b; }",
    });
    expect(graph.duplicateGroups("function")).toHaveLength(0);
  });

  it("collects arrow functions", () => {
    const graph = graphFor({
      "a.ts": "const add = (a: number, b: number) => a + b;",
    });
    expect(graph.functions().filter((fn) => fn.name === "add")).toHaveLength(1);
  });

  it("collects function expressions", () => {
    const graph = graphFor({
      "a.ts": "const add = function(a: number, b: number) { return a + b; };",
    });
    expect(graph.functions().filter((fn) => fn.name === "add")).toHaveLength(1);
  });

  it("collects class methods", () => {
    const graph = graphFor({
      "a.ts": "class Calculator { add(a: number, b: number) { return a + b; } }",
    });
    expect(graph.functions().filter((fn) => fn.name === "Calculator.add")).toHaveLength(1);
  });

  it("collects object property arrow functions", () => {
    const graph = graphFor({
      "a.ts": "const obj = { add: (a: number, b: number) => a + b };",
    });
    expect(graph.functions().filter((fn) => fn.name === "add")).toHaveLength(1);
  });

  it("collects object property function expressions", () => {
    const graph = graphFor({
      "a.ts": "const obj = { add: function(a: number, b: number) { return a + b; } };",
    });
    expect(graph.functions().filter((fn) => fn.name === "add")).toHaveLength(1);
  });

  it("tracks optional params", () => {
    const graph = graphFor({
      "a.ts": "function greet(name: string, greeting?: string) { return greeting + name; }",
    });
    const greet = graph.functions().find((fn) => fn.name === "greet");
    expect(greet).toBeDefined();
    expect(greet?.params).toHaveLength(2);
    expect(greet?.params[1]?.optional).toBe(true);
  });
});

describe("constants", () => {
  it("detects duplicate constant values across files", () => {
    const graph = graphFor({
      "a.ts": "const TIMEOUT = 3000;",
      "b.ts": "const DELAY = 3000;",
    });
    const dupes = graph.duplicateGroups("constant");
    expect(dupes.length).toBeGreaterThan(0);
    const [firstGroup] = dupes;
    expect(firstGroup).toBeDefined();
    expect(firstGroup).toHaveLength(2);
  });

  it("does not flag different constant values", () => {
    const graph = graphFor({
      "a.ts": "const TIMEOUT = 3000;",
      "b.ts": "const DELAY = 5000;",
    });
    expect(graph.duplicateGroups("constant")).toHaveLength(0);
  });

  it("collects string literals", () => {
    const graph = graphFor({
      "a.ts": 'const URL = "https://example.com";',
    });
    expect(graph.constants()).toHaveLength(1);
    expect(graph.constants()[0]?.valueText).toBe('"https://example.com"');
  });

  it("collects negative numbers", () => {
    const graph = graphFor({
      "a.ts": "const NEG = -1;",
    });
    expect(graph.constants()).toHaveLength(1);
  });

  it("collects binary expressions of literals", () => {
    const graph = graphFor({
      "a.ts": "const HOURS = 6 * 60 * 60;",
    });
    expect(graph.constants()).toHaveLength(1);
  });

  it("skips arrow functions", () => {
    const graph = graphFor({
      "a.ts": "const fn = () => 42;",
    });
    expect(graph.constants()).toHaveLength(0);
  });

  it("skips object literals", () => {
    const graph = graphFor({
      "a.ts": "const obj = { x: 1 };",
    });
    expect(graph.constants()).toHaveLength(0);
  });

  it("skips call expressions", () => {
    const graph = graphFor({
      "a.ts": "const val = someFunc();",
    });
    expect(graph.constants()).toHaveLength(0);
  });
});

describe("anonymous functions", () => {
  it("collects anonymous arrow function passed as call argument", () => {
    const graph = graphFor({
      "a.ts": `
        declare function register(cb: (x: string) => string): void;
        register((input: string) => {
          const trimmed = input.trim();
          const lower = trimmed.toLowerCase();
          return lower.replace(/\\s+/g, "-") + trimmed;
        });
      `,
    });
    expect(graph.functions().filter((fn) => fn.name === "register callback")).toHaveLength(1);
  });

  it("keeps a qualified callee and human argument position in callback names", () => {
    const graph = graphFor({
      "a.ts": `
        declare const hooks: {
          register(label: string, cb: (x: string) => string): void;
        };
        hooks.register("slug", (input: string) => {
          const trimmed = input.trim();
          const lower = trimmed.toLowerCase();
          return lower.replace(/\\s+/g, "-") + trimmed;
        });
      `,
    });
    expect(
      graph.functions().filter((fn) => fn.name === "hooks.register callback (argument 2)"),
    ).toHaveLength(1);
  });

  it("skips small anonymous functions", () => {
    const graph = graphFor({
      "a.ts": `
        declare const items: number[];
        items.map((x) => x + 1);
      `,
    });
    expect(graph.functions().filter((fn) => fn.name.includes("map."))).toHaveLength(0);
  });

  it("does not double-collect named arrow functions", () => {
    const graph = graphFor({
      "a.ts": "const add = (a: number, b: number) => { return a + b; };",
    });
    expect(graph.functions().filter((fn) => fn.name === "add")).toHaveLength(1);
  });

  it("derives name from grandparent PropertyAssignment", () => {
    const graph = graphFor({
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
    expect(graph.functions().filter((fn) => fn.name === "handler")).toHaveLength(1);
  });
});

describe("near duplicates", () => {
  it("groups near-duplicates by normalized hash", () => {
    const graph = graphFor({
      "a.ts": 'function greetEn(name: string) { return "Hello " + name; }',
      "b.ts": 'function greetEs(name: string) { return "Hola " + name; }',
    });
    const nearDuplicates = graph.duplicateGroups("function-normalized").filter(
      (group) => new Set(group.map((fn) => fn.hash)).size >= 2,
    );
    expect(nearDuplicates.length).toBeGreaterThan(0);
    expect(graph.duplicateGroups("function")).toHaveLength(0);
  });

  it("groups bodies differing only in null vs undefined", () => {
    const graph = graphFor({
      "a.ts": "export const readA = (job: { amount: number | null }): number | undefined => {\n  if (job.amount === null) {\n    return undefined;\n  }\n  return job.amount;\n};",
      "b.ts": "export const readB = (input: { amount: number | null }): number | null => {\n  if (input.amount === null) {\n    return null;\n  }\n  return input.amount;\n};",
    });
    const nearDuplicates = graph.duplicateGroups("function-normalized").filter(
      (group) => new Set(group.map((fn) => fn.hash)).size >= 2,
    );
    expect(nearDuplicates.length).toBeGreaterThan(0);
    expect(graph.duplicateGroups("function")).toHaveLength(0);
  });
});

describe("calls", () => {
  it("collects call sites with arg counts", () => {
    const graph = graphFor({
      "a.ts": [
        "function greet(name: string, greeting?: string): void {}",
        'greet("Alice", "Hi");',
        'greet("Bob");',
      ].join("\n"),
    });
    const greet = graph.functions().find((fn) => fn.name === "greet");
    if (greet === undefined) throw new Error("Missing greet function fact");
    const greetCalls = graph.calls().filter((call) => call.callee === greet.id);
    expect(greetCalls).toHaveLength(2);
    const [firstCall, secondCall] = greetCalls;
    expect(firstCall).toBeDefined();
    expect(secondCall).toBeDefined();
    expect(firstCall?.args).toHaveLength(2);
    expect(secondCall?.args).toHaveLength(1);
  });

  it("collects method call sites", () => {
    const graph = graphFor({
      "a.ts": [
        "class Example { method(a: number, b: number, c: number): void {} }",
        "const obj = new Example();",
        "obj.method(1, 2, 3);",
      ].join("\n"),
    });
    const method = graph.functions().find((fn) => fn.name === "Example.method");
    if (method === undefined) throw new Error("Missing method function fact");
    const methodCalls = graph.calls().filter((call) => call.callee === method.id);
    expect(methodCalls).toHaveLength(1);
    const [methodCall] = methodCalls;
    expect(methodCall).toBeDefined();
    expect(methodCall?.args).toHaveLength(3);
  });

  it("records the overload declaration selected for a call site", () => {
    const graph = graphFor({
      "a.ts": [
        "function parse(value: string): string;",
        "function parse(value: number): number;",
        "function parse(value: string | number): string | number { return value; }",
        'parse("x");',
        "parse(1);",
      ].join("\n"),
    });
    const parse = graph.functions().find((fn) => fn.name === "parse");
    if (parse === undefined) throw new Error("Missing parse function fact");
    const parseCalls = graph.calls().filter((call) => call.callee === parse.id);
    expect(graph.overloads(parse.id)).toHaveLength(3);
    expect(parseCalls).toHaveLength(2);
    expect(parseCalls.map((call) => call.resolvedSignature)).toEqual([0, 1]);
  });
});

describe("readers", () => {
  it("records the original binding read by a renamed export", () => {
    const graph = graphFor({
      "a.ts": "export const token = 1;\nexport { token as published };\n",
    });
    const token = graph.constants().find((constant) => constant.name === "token");
    if (token === undefined) throw new Error("Missing token constant fact");
    expect(graph.readers(token.id).map((reader) => reader.site.line)).toEqual([2]);
  });
});
