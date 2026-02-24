import { parseSync } from "oxc-parser";
import { readFileSync } from "node:fs";
import fg from "fast-glob";
import { expect } from "vitest";
import type { SingleFileRule, CrossFileRule, Diagnostic } from "../src/rules/types.ts";
import { runSingleFileRules } from "../src/engine.ts";
import { collectProject } from "../src/collect/index.ts";

/** Run a single-file rule against source code, return diagnostics. */
export function runRule(rule: SingleFileRule, source: string, filename = "test.ts"): Diagnostic[] {
  const result = parseSync(filename, source);
  return runSingleFileRules([rule], result.program, result.comments, source, filename);
}

/** Parse `// @expect <rule-id>` annotations from source. Returns set of 1-based line numbers. */
function parseExpectations(source: string, ruleId: string): Set<number> {
  const lines = source.split("\n");
  const expected = new Set<number>();
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (line.includes(`// @expect ${ruleId}`)) {
      expected.add(i + 1);
    }
  }
  return expected;
}

/** Assert rule produces 0 diagnostics on valid fixture. */
export function assertValid(rule: SingleFileRule, fixturePath: string): void {
  const source = readFileSync(fixturePath, "utf8");
  const diagnostics = runRule(rule, source, fixturePath);
  expect(diagnostics, `Expected no diagnostics in ${fixturePath}`).toHaveLength(0);
}

/** Assert rule diagnostics match @expect annotations in invalid fixture. */
export function assertInvalid(rule: SingleFileRule, fixturePath: string): void {
  const source = readFileSync(fixturePath, "utf8");
  const diagnostics = runRule(rule, source, fixturePath);
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
  const index = collectProject(files);
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
