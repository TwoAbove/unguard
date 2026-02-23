import { describe, it } from "vitest";
import { assertCrossFileValid, assertCrossFileInvalid } from "../../harness.ts";
import { duplicateTypeName } from "../../../src/rules/cross-file/duplicate-type-name.ts";

describe("duplicate-type-name", () => {
  it("allows same private type name across files", () => {
    assertCrossFileValid(duplicateTypeName, new URL("./valid", import.meta.url).pathname);
  });

  it("flags same exported type name across files", () => {
    assertCrossFileInvalid(duplicateTypeName, new URL("./invalid", import.meta.url).pathname);
  });
});
