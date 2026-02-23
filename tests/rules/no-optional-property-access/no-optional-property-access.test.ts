import { describe, it } from "vitest";
import { assertValid, assertInvalid } from "../../harness.ts";
import { noOptionalPropertyAccess } from "../../../src/rules/single-file/no-optional-property-access.ts";

describe("no-optional-property-access", () => {
  it("allows normal property access", () => {
    assertValid(noOptionalPropertyAccess, new URL("./valid.ts", import.meta.url).pathname);
  });
  it("flags optional property access", () => {
    assertInvalid(noOptionalPropertyAccess, new URL("./invalid.ts", import.meta.url).pathname);
  });
});
