import { describe, it } from "vitest";
import { assertValid, assertInvalid } from "../../harness.ts";
import { noUselessAwait } from "../../../src/rules/ts/no-useless-await.ts";

describe("no-useless-await", () => {
  it("allows awaiting promises, thenables, unions, and generics", () => {
    assertValid(noUselessAwait, new URL("./valid.ts", import.meta.url).pathname);
  });
  it("flags await on values that cannot be promises", () => {
    assertInvalid(noUselessAwait, new URL("./invalid.ts", import.meta.url).pathname);
  });
});
