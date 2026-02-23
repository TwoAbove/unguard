import { describe, it } from "vitest";
import { assertValid, assertInvalid } from "../../harness.ts";
import { preferDefaultParamValue } from "../../../src/rules/single-file/prefer-default-param-value.ts";

describe("prefer-default-param-value", () => {
  it("allows default params and non-param fallbacks", () => {
    assertValid(preferDefaultParamValue, new URL("./valid.ts", import.meta.url).pathname);
  });
  it("flags param reassignment with nullish coalescing", () => {
    assertInvalid(preferDefaultParamValue, new URL("./invalid.ts", import.meta.url).pathname);
  });
});
