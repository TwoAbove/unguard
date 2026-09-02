import { copyFileSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it, vi } from "vitest";
import { main } from "../src/cli.ts";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("cli", () => {
  it("--only is repeatable", async () => {
    const output: string[] = [];
    vi.spyOn(console, "log").mockImplementation((message) => output.push(String(message)));
    vi.spyOn(console, "error").mockImplementation(() => {});

    const code = await main([
      "node",
      "unguard",
      "tests/rules/no-any-cast/invalid.ts",
      "tests/rules/no-non-null-assertion/invalid.ts",
      "--only=no-any-cast",
      "--only=no-non-null-assertion",
      "--json",
      "--no-baseline",
      "--no-cache",
    ]);

    const report = JSON.parse(output.join("\n"));
    expect(code).toBe(2);
    expect(report.findings.map((finding: { ruleId: string }) => finding.ruleId)).toEqual(
      expect.arrayContaining(["no-any-cast", "no-non-null-assertion"]),
    );
  });

  it("supports fail-on thresholds", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});

    const warningCode = await main([
      "node",
      "unguard",
      "tests/rules/no-non-null-assertion/invalid.ts",
      "--only=no-non-null-assertion",
      "--fail-on=warning",
    ]);

    const errorCode = await main([
      "node",
      "unguard",
      "tests/rules/no-non-null-assertion/invalid.ts",
      "--only=no-non-null-assertion",
      "--fail-on=error",
    ]);

    expect(warningCode).toBe(1);
    expect(errorCode).toBe(0);
  });

  it("loads rule policy from config", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});

    const tmp = mkdtempSync(join(tmpdir(), "unguard-"));
    const configPath = join(tmp, "unguard.config.json");

    try {
      writeFileSync(
        configPath,
        JSON.stringify({
          paths: ["tests/rules/no-swallowed-catch/invalid.ts"],
          rules: { "no-swallowed-catch": "off" },
        }),
      );

      const code = await main(["node", "unguard", "--config", configPath]);
      expect(code).toBe(0);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("accepts category selector in --rule", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});

    const code = await main([
      "node",
      "unguard",
      "tests/rules/no-swallowed-catch/invalid.ts",
      "--only=no-swallowed-catch",
      "--rule=category:error-handling=warning",
      "--fail-on=error",
    ]);

    expect(code).toBe(0);
  });

  it("uses the smells JSON key without gating by default", async () => {
    const output: string[] = [];
    vi.spyOn(console, "log").mockImplementation((message) => output.push(String(message)));
    vi.spyOn(console, "error").mockImplementation(() => {});

    const code = await main([
      "node",
      "unguard",
      "smell",
      "tests/rules/trivial-type-alias/invalid.ts",
      "--only=trivial-type-alias",
      "--json",
      "--no-cache",
    ]);

    const report = JSON.parse(output.join("\n"));
    expect(code).toBe(0);
    expect(report.smells.map((smell: { ruleId: string }) => smell.ruleId)).toContain("trivial-type-alias");
    expect(report.findings).toBeUndefined();
  });

  it("fix reports its applied fixes as JSON", async () => {
    const output: string[] = [];
    vi.spyOn(console, "log").mockImplementation((message) => output.push(String(message)));
    vi.spyOn(console, "error").mockImplementation(() => {});

    const tmp = mkdtempSync(join(tmpdir(), "unguard-fix-"));
    const target = join(tmp, "invalid.ts");

    try {
      copyFileSync("tests/rules/no-nullish-coalescing/invalid.ts", target);
      const code = await main([
        "node",
        "unguard",
        "fix",
        target,
        "--only=no-nullish-coalescing",
        "--json",
        "--no-baseline",
        "--no-cache",
      ]);

      const report = JSON.parse(output.join("\n"));
      expect(code).toBe(0);
      expect(report.fixedCount).toBeGreaterThan(0);
      expect(report.findings).toEqual([]);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});
