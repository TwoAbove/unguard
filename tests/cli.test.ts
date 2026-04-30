import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it, vi } from "vitest";
import { main } from "../src/cli.ts";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("cli", () => {
  it("parses comma-separated --severity values", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});

    const code = await main([
      "node",
      "unguard",
      "tests/rules/no-any-cast/invalid.ts",
      "--filter=no-any-cast",
      "--severity=error,warning",
      "--format=flat",
    ]);

    expect(code).toBe(2);
  });

  it("supports fail-on thresholds", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});

    const warningCode = await main([
      "node",
      "unguard",
      "tests/rules/no-non-null-assertion/invalid.ts",
      "--filter=no-non-null-assertion",
      "--fail-on=warning",
      "--format=flat",
    ]);

    const errorCode = await main([
      "node",
      "unguard",
      "tests/rules/no-non-null-assertion/invalid.ts",
      "--filter=no-non-null-assertion",
      "--fail-on=error",
      "--format=flat",
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
      "--filter=no-swallowed-catch",
      "--rule=category:error-handling=warning",
      "--fail-on=error",
      "--format=flat",
    ]);

    expect(code).toBe(0);
  });
});
