import { describe, it } from "vitest";
import { assertCrossFileValid, assertCrossFileInvalid } from "../../harness.ts";
import { duplicateInlineTypeInParams } from "../../../src/rules/cross-file/duplicate-inline-type-in-params.ts";

describe("duplicate-inline-type-in-params", () => {
  it("allows unique inline param types", () => {
    assertCrossFileValid(duplicateInlineTypeInParams, new URL("./valid", import.meta.url).pathname);
  });
  it("flags duplicate inline param type shapes across files", () => {
    assertCrossFileInvalid(duplicateInlineTypeInParams, new URL("./invalid", import.meta.url).pathname);
  });
});
