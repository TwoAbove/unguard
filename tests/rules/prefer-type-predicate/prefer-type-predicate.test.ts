import { describe, it } from "vitest";
import { assertValid, assertInvalid } from "../../harness.ts";
import { preferTypePredicate } from "../../../src/rules/ts/prefer-type-predicate.ts";

describe("prefer-type-predicate", () => {
  it("allows functions that don't fit the predicate refactor", () => {
    assertValid(preferTypePredicate, new URL("./valid.ts", import.meta.url).pathname);
  });

  it("flags single-param boolean returns whose body is a structural narrowing", () => {
    assertInvalid(preferTypePredicate, new URL("./invalid.ts", import.meta.url).pathname);
  });
});
