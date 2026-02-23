import { describe, it } from "vitest";
import { assertValid, assertInvalid } from "../../harness.ts";
import { noNonNullAssertion } from "../../../src/rules/single-file/no-non-null-assertion.ts";

describe("no-non-null-assertion", () => {
  it("allows code without non-null assertions", () => {
    assertValid(noNonNullAssertion, new URL("./valid.ts", import.meta.url).pathname);
  });
  it("flags non-null assertions", () => {
    assertInvalid(noNonNullAssertion, new URL("./invalid.ts", import.meta.url).pathname);
  });
});
