import { describe, it } from "vitest";
import { assertCrossFileValid, assertCrossFileInvalid } from "../../harness.ts";
import { duplicateFunctionDeclaration } from "../../../src/rules/cross-file/duplicate-function-declaration.ts";

describe("duplicate-function-declaration", () => {
  it("allows different function bodies", () => {
    assertCrossFileValid(duplicateFunctionDeclaration, new URL("./valid", import.meta.url).pathname);
  });

  it("flags identical function bodies across files", () => {
    assertCrossFileInvalid(duplicateFunctionDeclaration, new URL("./invalid", import.meta.url).pathname);
  });
});
