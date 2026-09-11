import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as ts from "typescript";
import { describe, expect, it } from "vitest";
import { buildGraph } from "../../../src/graph/graph.ts";
import { optionalArgAlwaysUsed } from "../../../src/rules/cross-file/optional-arg-always-used.ts";
import { optionalArgNeverUsed } from "../../../src/rules/cross-file/optional-arg-never-used.ts";
import { deadOverload } from "../../../src/rules/cross-file/dead-overload.ts";
import type { CrossFileRule } from "../../../src/rules/types.ts";

function fixture(run: (file: string) => void): void {
  const directory = mkdtempSync(join(tmpdir(), "unguard-global-callers-"));
  try {
    run(join(directory, "source.ts"));
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

function collect(rule: CrossFileRule, file: string, source: string, reportable = true): unknown {
  writeFileSync(file, source);
  const program = ts.createProgram([file], { strict: true, target: ts.ScriptTarget.ESNext });
  return rule.collectGlobalFacts!(buildGraph(program), {
    reportableFiles: new Set(reportable ? [file] : []),
  });
}

describe("global caller evidence", () => {
  for (const [rule, call] of [
    [optionalArgAlwaysUsed, 'choose("x")'],
    [optionalArgNeverUsed, "choose()"],
  ] as const) {
    it(`${rule.id} does not count overlapping observations as extra call sites`, () => {
      fixture((file) => {
        const source = `export function choose(value?: string) { return value; }\n${call};`;
        const facts = collect(rule, file, source);
        expect(rule.finalizeGlobal!([facts, structuredClone(facts)])).toEqual([]);
        const twoSites = collect(rule, file, `${source}\n${call};`);
        const diagnostics = rule.finalizeGlobal!([twoSites, structuredClone(twoSites)]);
        expect(diagnostics).toHaveLength(1);
        expect(diagnostics[0]).toMatchObject({ file, line: 1, ruleId: rule.id });
        expect(diagnostics[0]?.message).toContain("2 call sites");
      });
    });

    it(`${rule.id} retains contradictory observations of an overlapping call`, () => {
      fixture((file) => {
        const declaration = "export function choose(value?: string) { return value; }\n";
        const supporting = collect(rule, file, `${declaration}${call};\n${call};`);
        const contrary = collect(rule, file, `${declaration}${call === "choose()" ? 'choose("x")' : "choose()"};`, false);
        expect(rule.finalizeGlobal!([supporting, contrary])).toEqual([]);
      });
    });

    it(`${rule.id} does not report non-reportable declarations`, () => {
      fixture((file) => {
        const source = `export function choose(value?: string) { return value; }\n${call};\n${call};`;
        expect(rule.finalizeGlobal!([collect(rule, file, source, false)])).toEqual([]);
      });
    });
  }

  it("retains different resolved overloads observed at the same call site", () => {
    fixture((file) => {
      const declaration = "export function choose(value: string): string;\nexport function choose(value: number): number;\nexport function choose(value: string | number) { return value; }\n";
      const stringCall = collect(deadOverload, file, `${declaration}choose("x");`);
      expect(deadOverload.finalizeGlobal!([stringCall])).toHaveLength(1);
      const numberCall = collect(deadOverload, file, `${declaration}choose(123);`, false);
      expect(deadOverload.finalizeGlobal!([stringCall, numberCall])).toEqual([]);
    });
  });

  for (const [rule, call] of [
    [optionalArgAlwaysUsed, 'new Base().choose("x")'],
    [optionalArgNeverUsed, "new Base().choose()"],
  ] as const) {
    it(`${rule.id} unions inherited contracts from non-reportable groups`, () => {
      fixture((file) => {
        const source = `export class Base { choose(value?: string) { return value; } }\n${call};\n${call};`;
        const supporting = collect(rule, file, source);
        expect(rule.finalizeGlobal!([supporting])).toHaveLength(1);
        const inherited = collect(rule, file, `${source}\nclass Derived extends Base { override choose(value?: string) { return value; } }`, false);
        expect(rule.finalizeGlobal!([supporting, inherited])).toEqual([]);
      });
    });
  }

  it("unions inherited overload contracts from non-reportable groups", () => {
    fixture((file) => {
      const source = "export class Base {\nchoose(value: string): string;\nchoose(value: number): number;\nchoose(value: string | number): string | number { return value; }\n}\nnew Base().choose(123);";
      const supporting = collect(deadOverload, file, source);
      expect(deadOverload.finalizeGlobal!([supporting])).toHaveLength(1);
      const inherited = collect(deadOverload, file, `${source}\nclass Derived extends Base {\noverride choose(value: string): string;\noverride choose(value: number): number;\noverride choose(value: string | number): string | number { return value; }\n}`, false);
      expect(deadOverload.finalizeGlobal!([supporting, inherited])).toEqual([]);
    });
  });

  it("does not report overloads outside reportable files", () => {
    fixture((file) => {
      const source = "export function choose(value: string): string;\nexport function choose(value: number): number;\nexport function choose(value: string | number) { return value; }\nchoose(123);";
      expect(deadOverload.finalizeGlobal!([collect(deadOverload, file, source, false)])).toEqual([]);
    });
  });
});
