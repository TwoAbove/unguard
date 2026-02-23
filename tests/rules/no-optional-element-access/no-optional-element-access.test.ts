import { describe, it } from "vitest";
import { assertValid, assertInvalid } from "../../harness.ts";
import { noOptionalElementAccess } from "../../../src/rules/single-file/no-optional-element-access.ts";

describe("no-optional-element-access", () => {
  it("allows normal element access", () => {
    assertValid(noOptionalElementAccess, new URL("./valid.ts", import.meta.url).pathname);
  });
  it("flags optional element access", () => {
    assertInvalid(noOptionalElementAccess, new URL("./invalid.ts", import.meta.url).pathname);
  });
});
