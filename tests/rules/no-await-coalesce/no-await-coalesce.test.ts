import { describe, it } from "vitest";
import { assertValid, assertInvalid } from "../../harness.ts";
import { noAwaitCoalesce } from "../../../src/rules/ts/no-await-coalesce.ts";

describe("no-await-coalesce", () => {
  it("allows ?? on structural optionals (no call-derived nullability)", () => {
    assertValid(noAwaitCoalesce, new URL("./valid.ts", import.meta.url).pathname);
  });
  it("flags ?? when the LHS nullability comes from a call's return type", () => {
    assertInvalid(noAwaitCoalesce, new URL("./invalid.ts", import.meta.url).pathname);
  });
});
