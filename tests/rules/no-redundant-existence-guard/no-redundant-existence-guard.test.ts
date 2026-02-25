import { describe, it } from "vitest";
import { assertValid, assertInvalid } from "../../harness.ts";
import { noRedundantExistenceGuard } from "../../../src/rules/ts/no-redundant-existence-guard.ts";

describe("no-redundant-existence-guard", () => {
  it("allows legitimate existence guards", () => {
    assertValid(noRedundantExistenceGuard, new URL("./valid.ts", import.meta.url).pathname);
  });
  it("flags redundant existence guards on non-nullable types", () => {
    assertInvalid(noRedundantExistenceGuard, new URL("./invalid.ts", import.meta.url).pathname);
  });
});
