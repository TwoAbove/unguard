import { describe, it } from "vitest";
import { assertValid, assertInvalid } from "../../harness.ts";
import { noNonNullAssertion } from "../../../src/rules/ts/no-non-null-assertion.ts";

describe("no-non-null-assertion", () => {
  it("allows safe non-null patterns", () => {
    assertValid(noNonNullAssertion, new URL("./valid.ts", import.meta.url).pathname);
  });
  it("flags unguarded non-null assertions on nullable types", () => {
    assertInvalid(noNonNullAssertion, new URL("./invalid.ts", import.meta.url).pathname);
  });
});
