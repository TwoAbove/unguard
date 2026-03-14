import { describe, it } from "vitest";
import { assertCrossFileValid, assertCrossFileInvalid } from "../../harness.ts";
import { repeatedLiteralProperty } from "../../../src/rules/cross-file/repeated-literal-property.ts";

describe("repeated-literal-property", () => {
  it("allows values below threshold", () => {
    assertCrossFileValid(repeatedLiteralProperty, new URL("./valid", import.meta.url).pathname);
  });

  it("flags repeated literal property values", () => {
    assertCrossFileInvalid(repeatedLiteralProperty, new URL("./invalid", import.meta.url).pathname);
  });
});
