import { describe, it } from "vitest";
import { assertInvalid, assertValid } from "../../harness.ts";
import { noInlineTypeAssertion } from "../../../src/rules/ts/no-inline-type-assertion.ts";

describe("no-inline-type-assertion", () => {
  it("allows named and primitive assertions", () => {
    assertValid(noInlineTypeAssertion, new URL("./valid.ts", import.meta.url).pathname);
  });

  it("flags inline object type assertions", () => {
    assertInvalid(noInlineTypeAssertion, new URL("./invalid.ts", import.meta.url).pathname);
  });
});
