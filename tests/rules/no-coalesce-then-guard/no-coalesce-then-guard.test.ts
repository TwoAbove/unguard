import { describe, it } from "vitest";
import { assertValid, assertInvalid } from "../../harness.ts";
import { noCoalesceThenGuard } from "../../../src/rules/ts/no-coalesce-then-guard.ts";

describe("no-coalesce-then-guard", () => {
  it("allows ?? without a partition-identical guard", () => {
    assertValid(noCoalesceThenGuard, new URL("./valid.ts", import.meta.url).pathname);
  });
  it("flags ?? followed by a guard that partitions identically", () => {
    assertInvalid(noCoalesceThenGuard, new URL("./invalid.ts", import.meta.url).pathname);
  });
});
