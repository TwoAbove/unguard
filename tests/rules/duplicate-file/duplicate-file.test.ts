import { describe, it, expect } from "vitest";
import { assertCrossFileValid, runCrossFileRule } from "../../harness.ts";
import { duplicateFile } from "../../../src/rules/cross-file/duplicate-file.ts";

describe("duplicate-file", () => {
  it("allows files with different content", () => {
    assertCrossFileValid(duplicateFile, new URL("./valid", import.meta.url).pathname);
  });

  it("flags files with identical content", () => {
    const dir = new URL("./invalid", import.meta.url).pathname;
    const diagnostics = runCrossFileRule(duplicateFile, dir);
    // Should flag exactly 1 file (the second alphabetically)
    expect(diagnostics).toHaveLength(1);
    const diag = diagnostics[0];
    expect(diag).toBeDefined();
    expect(diag?.file).toContain("file-b.ts");
    expect(diag?.line).toBe(1);
    expect(diag?.ruleId).toBe("duplicate-file");
  });
});
