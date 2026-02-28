import { readFileSync } from "node:fs";
import fg from "fast-glob";
import { expect } from "vitest";
import type { CrossFileRule, TSRule, Diagnostic } from "../src/rules/types.ts";
import { collectProject } from "../src/collect/index.ts";
import { createProgramFromFiles } from "../src/typecheck/program.ts";

/** Run a TS rule against a fixture file with full type checking. */
function runTSRule(rule: TSRule, fixturePath: string): Diagnostic[] {
  const program = createProgramFromFiles([fixturePath]);
  const { diagnostics } = collectProject(program, [rule]);
  return diagnostics;
}

/** Parse `// @expect <rule-id>` annotations from source. Returns set of 1-based line numbers. */
function parseExpectations(source: string, ruleId: string): Set<number> {
  const lines = source.split("\n");
  const expected = new Set<number>();
  for (const [i, line] of lines.entries()) {
    if (line.includes(`// @expect ${ruleId}`)) {
      expected.add(i + 1);
    }
  }
  return expected;
}

/** Assert rule produces 0 diagnostics on valid fixture. */
export function assertValid(rule: TSRule, fixturePath: string): void {
  const diagnostics = runTSRule(rule, fixturePath);
  expect(diagnostics, `Expected no diagnostics in ${fixturePath}`).toHaveLength(0);
}

/** Assert rule diagnostics match @expect annotations in invalid fixture. */
export function assertInvalid(rule: TSRule, fixturePath: string): void {
  const source = readFileSync(fixturePath, "utf8");
  const diagnostics = runTSRule(rule, fixturePath);
  const expected = parseExpectations(source, rule.id);

  expect(expected.size, `No @expect annotations found in ${fixturePath}`).toBeGreaterThan(0);

  const diagLines = new Set(diagnostics.map((d) => d.line));
  for (const line of expected) {
    expect(diagLines.has(line), `Expected diagnostic at line ${line} in ${fixturePath}`).toBe(true);
  }
  for (const d of diagnostics) {
    expect(expected.has(d.line), `Unexpected diagnostic at line ${d.line}: ${d.message}`).toBe(true);
  }
}

/** Collect all .ts files from a directory. */
function collectFixtureFiles(dir: string): string[] {
  return fg.sync(`${dir}/**/*.ts`, { absolute: true });
}

/** Run a cross-file rule against a directory of fixtures, return diagnostics. */
export function runCrossFileRule(rule: CrossFileRule, fixtureDir: string): Diagnostic[] {
  const files = collectFixtureFiles(fixtureDir);
  const program = createProgramFromFiles(files);
  const { index } = collectProject(program);
  return rule.analyze(index);
}

/** Assert cross-file rule produces 0 diagnostics on valid fixture directory. */
export function assertCrossFileValid(rule: CrossFileRule, fixtureDir: string): void {
  const diagnostics = runCrossFileRule(rule, fixtureDir);
  expect(diagnostics, `Expected no diagnostics in ${fixtureDir}`).toHaveLength(0);
}

/** Assert cross-file rule diagnostics match @expect annotations across fixture directory. */
export function assertCrossFileInvalid(rule: CrossFileRule, fixtureDir: string): void {
  const files = collectFixtureFiles(fixtureDir);
  const diagnostics = runCrossFileRule(rule, fixtureDir);

  const expectedByFile = new Map<string, Set<number>>();
  for (const file of files) {
    const source = readFileSync(file, "utf8");
    const expected = parseExpectations(source, rule.id);
    if (expected.size > 0) expectedByFile.set(file, expected);
  }

  const totalExpected = [...expectedByFile.values()].reduce((sum, s) => sum + s.size, 0);
  expect(totalExpected, `No @expect annotations found in ${fixtureDir}`).toBeGreaterThan(0);

  for (const d of diagnostics) {
    const expected = expectedByFile.get(d.file);
    expect(expected?.has(d.line), `Unexpected diagnostic at ${d.file}:${d.line}: ${d.message}`).toBe(true);
  }

  for (const [file, lines] of expectedByFile) {
    const diagLines = new Set(diagnostics.filter((d) => d.file === file).map((d) => d.line));
    for (const line of lines) {
      expect(diagLines.has(line), `Expected diagnostic at ${file}:${line}`).toBe(true);
    }
  }
}
