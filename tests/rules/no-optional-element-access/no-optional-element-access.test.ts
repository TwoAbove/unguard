import { describe, it } from "vitest";
import { assertValid, assertInvalid } from "../../harness.ts";
import { noOptionalElementAccess } from "../../../src/rules/ts/no-optional-element-access.ts";

describe("no-optional-element-access", () => {
  it("allows nullable element access", () => {
    assertValid(noOptionalElementAccess, new URL("./valid.ts", import.meta.url).pathname);
  });
  it("flags non-nullable optional element access", () => {
    assertInvalid(noOptionalElementAccess, new URL("./invalid.ts", import.meta.url).pathname);
  });
});
