import { describe, it } from "vitest";
import { assertCrossFileValid, assertCrossFileInvalid } from "../../harness.ts";
import { optionalArgAlwaysUsed } from "../../../src/rules/cross-file/optional-arg-always-used.ts";

describe("optional-arg-always-used", () => {
  it("allows optional params not always provided", () => {
    assertCrossFileValid(optionalArgAlwaysUsed, new URL("./valid", import.meta.url).pathname);
  });

  it("flags optional params always provided", () => {
    assertCrossFileInvalid(optionalArgAlwaysUsed, new URL("./invalid", import.meta.url).pathname);
  });
});
