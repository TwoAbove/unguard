import { describe, it, expect } from "vitest";
import { scan } from "../src/engine.ts";

describe("engine", () => {
  it("scans test fixtures and finds diagnostics", async () => {
    const result = await scan({ paths: ["tests/rules/no-empty-catch/invalid.ts"] });
    expect(result.diagnostics.length).toBeGreaterThan(0);
    expect(result.diagnostics[0]!.ruleId).toBe("no-empty-catch");
  });

  it("returns 0 diagnostics for valid code", async () => {
    const result = await scan({
      paths: ["tests/rules/no-empty-catch/valid.ts"],
      rules: ["no-empty-catch"],
    });
    expect(result.diagnostics).toHaveLength(0);
  });

  it("promotes to errors in strict mode", async () => {
    const result = await scan({ paths: ["tests/rules/no-empty-catch/invalid.ts"], strict: true });
    expect(result.diagnostics.every((d) => d.severity === "error")).toBe(true);
  });

  it("filters by rule ID", async () => {
    const result = await scan({
      paths: ["tests/rules/no-empty-catch/invalid.ts"],
      rules: ["no-any-cast"],
    });
    expect(result.diagnostics).toHaveLength(0);
  });
});
