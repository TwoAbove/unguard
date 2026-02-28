import { describe, it } from "vitest";
import { assertCrossFileValid, assertCrossFileInvalid } from "../../harness.ts";
import { duplicateConstantDeclaration } from "../../../src/rules/cross-file/duplicate-constant-declaration.ts";

describe("duplicate-constant-declaration", () => {
  it("allows different constant values", () => {
    assertCrossFileValid(duplicateConstantDeclaration, new URL("./valid", import.meta.url).pathname);
  });

  it("flags identical constant values across files", () => {
    assertCrossFileInvalid(duplicateConstantDeclaration, new URL("./invalid", import.meta.url).pathname);
  });
});
