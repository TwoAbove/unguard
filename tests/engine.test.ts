import { describe, it, expect } from "vitest";
import { scan } from "../src/engine.ts";
import { analyzeFiles } from "../src/scan/analyze.ts";
import { allRules } from "../src/rules/index.ts";

describe("engine", () => {
  it("scans test fixtures and finds diagnostics", async () => {
    const result = await scan({ paths: ["tests/rules/no-swallowed-catch/invalid.ts"] });
    expect(result.diagnostics.length).toBeGreaterThan(0);
    const [firstDiagnostic] = result.diagnostics;
    expect(firstDiagnostic).toBeDefined();
    expect(firstDiagnostic?.ruleId).toBe("no-swallowed-catch");
  });

  it("returns 0 diagnostics for valid code", async () => {
    const result = await scan({
      paths: ["tests/rules/no-swallowed-catch/valid.ts"],
      rules: ["no-swallowed-catch"],
    });
    expect(result.diagnostics).toHaveLength(0);
  });

  it("promotes to errors in strict mode", async () => {
    const result = await scan({ paths: ["tests/rules/no-swallowed-catch/invalid.ts"], strict: true });
    expect(result.diagnostics.every((d) => d.severity === "error")).toBe(true);
  });

  it("filters by rule ID", async () => {
    const result = await scan({
      paths: ["tests/rules/no-swallowed-catch/invalid.ts"],
      rules: ["no-any-cast"],
    });
    expect(result.diagnostics).toHaveLength(0);
  });

  it("skips declaration files in source-only analysis", async () => {
    const file = new URL("./fixtures/declaration-file.d.ts", import.meta.url).pathname;
    const rules = allRules.filter((rule) => rule.id === "no-inline-param-type");
    expect(await analyzeFiles([file], rules, {})).toHaveLength(0);
  });

  it("keeps project context for symbol-based cross-file rules when scanning one file", async () => {
    const result = await scan({
      paths: [new URL("./fixtures/project-context/lib.ts", import.meta.url).pathname],
      rules: ["unused-export"],
    });
    expect(result.diagnostics).toHaveLength(0);
  });

  it("keeps project context for syntax-only cross-file rules when scanning one file", async () => {
    const file = new URL("./fixtures/project-context/z.ts", import.meta.url).pathname;
    const result = await scan({
      paths: [file],
      rules: ["duplicate-function-declaration"],
    });
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0]?.file).toBe(file);
  });

  it("reports syntax-only duplicate groups on a scanned first-sorted member", async () => {
    const file = new URL("./fixtures/project-context/a.ts", import.meta.url).pathname;
    const result = await scan({
      paths: [file],
      rules: ["duplicate-function-declaration"],
    });
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0]?.file).toBe(file);
  });

  it("reports program-backed duplicate groups on a scanned first-sorted member", async () => {
    const file = new URL("./fixtures/project-context/a.ts", import.meta.url).pathname;
    const result = await scan({
      paths: [file],
      rules: ["duplicate-function-declaration", "no-any-cast"],
    });
    const duplicates = result.diagnostics.filter((d) => d.ruleId === "duplicate-function-declaration");
    expect(duplicates).toHaveLength(1);
    expect(duplicates[0]?.file).toBe(file);
  });

  it("keeps syntax-only cross-file indexes scoped to separate tsconfig groups", async () => {
    const first = new URL("./fixtures/group-isolation/one/a.ts", import.meta.url).pathname;
    const second = new URL("./fixtures/group-isolation/two/z.ts", import.meta.url).pathname;
    const result = await scan({
      paths: [first, second],
      rules: ["duplicate-function-declaration"],
    });
    expect(result.diagnostics).toHaveLength(0);
  });

  it("keeps program-backed cross-file indexes scoped to separate tsconfig groups", async () => {
    const first = new URL("./fixtures/group-isolation/one/a.ts", import.meta.url).pathname;
    const second = new URL("./fixtures/group-isolation/two/z.ts", import.meta.url).pathname;
    const result = await scan({
      paths: [first, second],
      rules: ["duplicate-function-declaration", "no-any-cast"],
    });
    expect(result.diagnostics.filter((d) => d.ruleId === "duplicate-function-declaration")).toHaveLength(0);
  });

  it("keeps symbol-based usage indexes scoped to separate tsconfig groups", async () => {
    const unused = new URL("./fixtures/group-isolation/one/unused.ts", import.meta.url).pathname;
    const used = new URL("./fixtures/group-isolation/two/used.ts", import.meta.url).pathname;
    const result = await scan({
      paths: [unused, used],
      rules: ["unused-export"],
    });
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0]?.file).toBe(unused);
  });

  it("ignores files from custom glob patterns", async () => {
    const result = await scan({
      paths: ["tests/rules/no-swallowed-catch/invalid.ts"],
      rules: ["no-swallowed-catch"],
      ignore: ["**/tests/rules/no-swallowed-catch/**"],
    });
    expect(result.fileCount).toBe(0);
    expect(result.diagnostics).toHaveLength(0);
  });

  it("overrides rule severity by exact rule id", async () => {
    const result = await scan({
      paths: ["tests/rules/no-any-cast/invalid.ts"],
      rules: ["no-any-cast"],
      rulePolicy: { "no-any-cast": "warning" },
    });
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0]?.severity).toBe("warning");
  });

  it("supports wildcard rule policy and off severity", async () => {
    const offResult = await scan({
      paths: ["tests/rules/duplicate-function-declaration/invalid"],
      rules: ["duplicate-function-declaration"],
      rulePolicy: { "duplicate-*": "off" },
    });
    expect(offResult.diagnostics).toHaveLength(0);

    const errorResult = await scan({
      paths: ["tests/rules/duplicate-function-declaration/invalid"],
      rules: ["duplicate-function-declaration"],
      rulePolicy: { "duplicate-*": "error" },
    });
    expect(errorResult.diagnostics.length).toBeGreaterThan(0);
    expect(errorResult.diagnostics[0]?.severity).toBe("error");
  });

  it("supports category and tag selectors in rule policy", async () => {
    const categoryResult = await scan({
      paths: ["tests/rules/no-swallowed-catch/invalid.ts"],
      rules: ["no-swallowed-catch"],
      rulePolicy: [{ selector: "category:error-handling", severity: "warning" }],
    });
    expect(categoryResult.diagnostics[0]?.severity).toBe("warning");

    const tagResult = await scan({
      paths: ["tests/rules/no-swallowed-catch/invalid.ts"],
      rules: ["no-swallowed-catch"],
      rulePolicy: [{ selector: "tag:safety", severity: "off" }],
    });
    expect(tagResult.diagnostics).toHaveLength(0);
  });

  it("suppresses warning diagnostics with @unguard comments", async () => {
    const result = await scan({
      paths: ["tests/fixtures/unguard-warning.ts"],
      rules: ["no-nullish-coalescing"],
    });
    expect(result.diagnostics).toHaveLength(0);
  });

  it("suppresses info diagnostics with @unguard comments", async () => {
    const result = await scan({
      paths: ["tests/fixtures/unguard-info.ts"],
      rules: ["no-double-negation-coercion"],
    });
    expect(result.diagnostics).toHaveLength(0);
  });

  it("suppresses diagnostics with @unguard comment inside block body (K&R formatting)", async () => {
    const result = await scan({
      paths: ["tests/fixtures/unguard-catch-inside.ts"],
      rules: ["no-swallowed-catch"],
    });
    expect(result.diagnostics).toHaveLength(0);
  });

  it("does not suppress error diagnostics with @unguard comments", async () => {
    const result = await scan({
      paths: ["tests/fixtures/unguard-error.ts"],
      rules: ["no-any-cast"],
    });
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0]?.severity).toBe("error");
  });
});

describe("cache", () => {
  it("invalidates when active rules change", async () => {
    const { cacheCovers, computeScanKey } = await import("../src/scan/cache.ts");
    const { allRules } = await import("../src/rules/index.ts");
    const baseInput = {
      unguardVersion: "test",
      paths: ["src"],
      ignore: [],
      strict: false,
      failOn: "info",
      showSeverities: null,
    };
    const keyA = computeScanKey({ ...baseInput, rules: allRules });
    const keyB = computeScanKey({ ...baseInput, rules: allRules.slice(0, 5) });
    expect(keyA).not.toBe(keyB);

    const cached = {
      version: 1,
      unguardVersion: "test",
      scanKey: keyA,
      fileHashes: { "/foo.ts": "1:1@aaaa" },
      diagnostics: [],
      fileCount: 1,
    };
    expect(cacheCovers(cached, { unguardVersion: "test", scanKey: keyA }, { "/foo.ts": "1:1@aaaa" })).toBe(true);
    expect(cacheCovers(cached, { unguardVersion: "test", scanKey: keyB }, { "/foo.ts": "1:1@aaaa" })).toBe(false);
  });

  it("treats stat-only changes as cache hits when content hash matches", async () => {
    const { cacheCovers } = await import("../src/scan/cache.ts");
    const cached = {
      version: 1,
      unguardVersion: "test",
      scanKey: "k",
      fileHashes: { "/foo.ts": "100:1000@deadbeef" },
      diagnostics: [],
      fileCount: 1,
    };
    // Same content hash, different stat tag (e.g., after `touch` or `git checkout`)
    expect(
      cacheCovers(cached, { unguardVersion: "test", scanKey: "k" }, { "/foo.ts": "100:9999@deadbeef" }),
    ).toBe(true);
    // Different content hash -> miss
    expect(
      cacheCovers(cached, { unguardVersion: "test", scanKey: "k" }, { "/foo.ts": "100:1000@cafef00d" }),
    ).toBe(false);
  });

  it("invalidates when file set changes", async () => {
    const { cacheCovers } = await import("../src/scan/cache.ts");
    const cached = {
      version: 1,
      unguardVersion: "test",
      scanKey: "k",
      fileHashes: { "/foo.ts": "1:1@aaaa", "/bar.ts": "1:1@bbbb" },
      diagnostics: [],
      fileCount: 2,
    };
    // Removed file
    expect(
      cacheCovers(cached, { unguardVersion: "test", scanKey: "k" }, { "/foo.ts": "1:1@aaaa" }),
    ).toBe(false);
    // Added file
    expect(
      cacheCovers(cached, { unguardVersion: "test", scanKey: "k" }, {
        "/foo.ts": "1:1@aaaa",
        "/bar.ts": "1:1@bbbb",
        "/baz.ts": "1:1@cccc",
      }),
    ).toBe(false);
  });
});
