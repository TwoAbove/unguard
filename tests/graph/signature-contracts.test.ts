import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as ts from "typescript";
import { describe, expect, it } from "vitest";
import { buildGraph, buildSourceOnlyGraph } from "../../src/graph/graph.ts";
import { createProgramForGroup, groupFilesByTsconfig } from "../../src/typecheck/program.ts";

function withProgram(files: Record<string, string>, check: (program: ts.Program, root: string) => void): void {
  const root = mkdtempSync(join(tmpdir(), "unguard-signature-contracts-"));
  try {
    const paths = Object.entries(files).map(([name, source]) => {
      const path = join(root, name);
      writeFileSync(path, source);
      return path;
    });
    const [group] = groupFilesByTsconfig(paths);
    if (group === undefined) throw new Error("No fixture program group");
    check(createProgramForGroup(group, {}), root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

describe("signature contracts", () => {
  it("constrains both ends outside graph membership through an intermediate base", () => {
    withProgram({
      "base.ts": `export class Base {
        shared(value?: number) { return value; }
        static sharedStatic(value?: number) { return value; }
        static instanceOnly(value?: number) { return value; }
        staticOnly(value?: number) { return value; }
      }
      export class GenericBase<T> { inherited(value: T) { return value; } }
      export class Middle extends Base {}`,
      "child.ts": `import { Middle, GenericBase } from "./base";
      class GenericChild<T> extends GenericBase<T> {}
      class ConcreteChild extends GenericChild<number> {}
      export class Child extends Middle {
        shared(value?: number) { return value; }
        static sharedStatic(value?: number) { return value; }
        instanceOnly(value?: number) { return value; }
        static staticOnly(value?: number) { return value; }
        own(value?: number) { return value; }
      }`,
    }, (program, root) => {
      const all = buildGraph(program);
      const child = buildGraph(program, { files: new Set([join(root, "child.ts")]) });
      const constraints = child.signatureConstraints();
      expect(all.functions().filter((fn) => constraints.has(fn.id)).map((fn) => fn.name).sort()).toEqual([
        "Base.shared", "Base.sharedStatic", "Child.shared", "Child.sharedStatic",
      ]);
      expect(child.functions().every((fn) => fn.site.file === join(root, "child.ts"))).toBe(true);
    });
  });

  it("matches inherited implementations, interface extension, and computed members", () => {
    withProgram({
      "contracts.ts": `const key: unique symbol = Symbol();
      interface Parent { shared(value?: number): number | undefined; }
      interface Contract extends Parent { shared(value?: number): number | undefined; }
      class Base { shared(value?: number) { return value; } }
      class Child extends Base implements Contract {
        own(value?: number) { return value; }
      }
      class ComputedBase { [key](value?: number) { return value; } }
      class ComputedChild extends ComputedBase { [key](value?: number) { return value; } }`,
    }, (program) => {
      const graph = buildGraph(program);
      const constraints = graph.signatureConstraints();
      expect(graph.functions().filter((fn) => constraints.has(fn.id)).map((fn) => fn.name)).toEqual(["Base.shared"]);
      const families = [...graph.overloadFamilies()].filter((family) => family.name === "[key]");
      expect(families).toHaveLength(2);
      expect(families.every((family) => constraints.has(family.id))).toBe(true);
    });
  });


  it("tracks anonymous class-expression instance and static overrides separately", () => {
    withProgram({
      "expressions.ts": `const Base = class {
        shared(value?: number) { return value; }
        static sharedStatic(value?: number) { return value; }
      };
      const Child = class extends Base {
        shared(value?: number) { return value; }
        static sharedStatic(value?: number) { return value; }
        own(value?: number) { return value; }
      };`,
    }, (program) => {
      const graph = buildGraph(program);
      const constraints = graph.signatureConstraints();
      const constrained = [...graph.overloadFamilies()].filter((family) => constraints.has(family.id));
      expect(constrained.map((family) => family.name).sort()).toEqual([
        "shared", "shared", "sharedStatic", "sharedStatic",
      ]);
    });
  });
  it("preserves declaration-file contracts without treating unrelated members as constrained", () => {
    withProgram({
      "external.d.ts": "export interface External { shared(value?: number): number | undefined; }",
      "child.ts": `import type { External } from "./external";
      class Child implements External {
        shared(value?: number) { return value; }
        own(value?: number) { return value; }
      }`,
    }, (program) => {
      const graph = buildGraph(program);
      expect(graph.functions().filter((fn) => graph.signatureConstraints().has(fn.id)).map((fn) => fn.name))
        .toEqual(["Child.shared"]);
    });
  });

  it("keeps source-only declaration and module queries available", () => {
    const source = ts.createSourceFile("source.ts", "class Base {} class Child extends Base { own(value?: number) { return value; } }", ts.ScriptTarget.Latest, true);
    const graph = buildSourceOnlyGraph([source]);
    expect(graph.functions().map((fn) => fn.name)).toEqual(["Child.own"]);
    expect(graph.imports()).toEqual([]);
    expect(() => graph.signatureConstraints()).toThrow(/needs type information/);
  });

  it("resolves imported overload signatures even when their family is outside the graph", () => {
    withProgram({
      "overloads.ts": `export function choose(value: string): string;
      export function choose(value: number): number;
      export function choose(value: string | number) { return value; }`,
      "calls.ts": `import { choose } from "./overloads"; choose(1); choose("x");`,
    }, (program, root) => {
      const owner = buildGraph(program, { files: new Set([join(root, "overloads.ts")]) });
      const caller = buildGraph(program, { files: new Set([join(root, "calls.ts")]) });
      const fn = owner.functions().find((entry) => entry.name === "choose");
      if (fn === undefined) throw new Error("Missing choose declaration");
      const signatures = owner.overloads(fn.id);
      expect(caller.overloads(fn.id)).toEqual([]);
      expect(caller.callers(fn.id).map((call) => call.resolvedSignature)).toEqual([signatures[1]?.id, signatures[0]?.id]);
    });
  });
});
