import { describe, it } from "vitest";
import { assertCrossFileValid, assertCrossFileInvalid } from "../../harness.ts";
import { unusedExport } from "../../../src/rules/cross-file/unused-export.ts";

describe("unused-export", () => {
  it("allows exported functions that are imported and used", () => {
    assertCrossFileValid(unusedExport, new URL("./valid", import.meta.url).pathname);
  });

  it("flags exported functions with no usages from other files", () => {
    assertCrossFileInvalid(unusedExport, new URL("./invalid", import.meta.url).pathname);
  });
});
