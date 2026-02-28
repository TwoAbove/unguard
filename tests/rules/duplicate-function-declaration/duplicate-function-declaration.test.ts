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

  it("allows class methods with different bodies", () => {
    assertCrossFileValid(duplicateFunctionDeclaration, new URL("./valid-methods", import.meta.url).pathname);
  });

  it("flags class method with identical body to standalone function", () => {
    assertCrossFileInvalid(duplicateFunctionDeclaration, new URL("./invalid-methods", import.meta.url).pathname);
  });

  it("flags identical function bodies in same file", () => {
    assertCrossFileInvalid(duplicateFunctionDeclaration, new URL("./invalid-same-file", import.meta.url).pathname);
  });
});
