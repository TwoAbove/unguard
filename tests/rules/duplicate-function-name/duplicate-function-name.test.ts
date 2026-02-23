import { describe, it } from "vitest";
import { assertCrossFileValid, assertCrossFileInvalid } from "../../harness.ts";
import { duplicateFunctionName } from "../../../src/rules/cross-file/duplicate-function-name.ts";

describe("duplicate-function-name", () => {
  it("allows same private function name across files", () => {
    assertCrossFileValid(duplicateFunctionName, new URL("./valid", import.meta.url).pathname);
  });

  it("flags same exported function name across files", () => {
    assertCrossFileInvalid(duplicateFunctionName, new URL("./invalid", import.meta.url).pathname);
  });
});
