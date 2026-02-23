import { describe, it } from "vitest";
import { assertCrossFileValid, assertCrossFileInvalid } from "../../harness.ts";
import { duplicateTypeDeclaration } from "../../../src/rules/cross-file/duplicate-type-declaration.ts";

describe("duplicate-type-declaration", () => {
  it("allows different type shapes", () => {
    assertCrossFileValid(duplicateTypeDeclaration, new URL("./valid", import.meta.url).pathname);
  });

  it("flags identical type shapes across files", () => {
    assertCrossFileInvalid(duplicateTypeDeclaration, new URL("./invalid", import.meta.url).pathname);
  });
});
