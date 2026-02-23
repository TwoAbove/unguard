import { describe, it } from "vitest";
import { assertValid, assertInvalid } from "../../harness.ts";
import { noRedundantExistenceGuard } from "../../../src/rules/single-file/no-redundant-existence-guard.ts";

describe("no-redundant-existence-guard", () => {
  it("allows guards with different objects", () => {
    assertValid(noRedundantExistenceGuard, new URL("./valid.ts", import.meta.url).pathname);
  });
  it("flags redundant existence guards", () => {
    assertInvalid(noRedundantExistenceGuard, new URL("./invalid.ts", import.meta.url).pathname);
  });
});
