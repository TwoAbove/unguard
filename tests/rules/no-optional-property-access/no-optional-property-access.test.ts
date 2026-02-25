import { describe, it } from "vitest";
import { assertValid, assertInvalid } from "../../harness.ts";
import { noOptionalPropertyAccess } from "../../../src/rules/ts/no-optional-property-access.ts";

describe("no-optional-property-access", () => {
  it("allows nullable optional chaining", () => {
    assertValid(noOptionalPropertyAccess, new URL("./valid.ts", import.meta.url).pathname);
  });
  it("flags non-nullable optional chaining", () => {
    assertInvalid(noOptionalPropertyAccess, new URL("./invalid.ts", import.meta.url).pathname);
  });
});
