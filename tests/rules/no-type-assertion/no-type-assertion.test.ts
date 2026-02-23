import { describe, it } from "vitest";
import { assertValid, assertInvalid } from "../../harness.ts";
import { noTypeAssertion } from "../../../src/rules/single-file/no-type-assertion.ts";

describe("no-type-assertion", () => {
  it("allows as const and as unknown", () => {
    assertValid(noTypeAssertion, new URL("./valid.ts", import.meta.url).pathname);
  });

  it("flags as Type casts", () => {
    assertInvalid(noTypeAssertion, new URL("./invalid.ts", import.meta.url).pathname);
  });
});
