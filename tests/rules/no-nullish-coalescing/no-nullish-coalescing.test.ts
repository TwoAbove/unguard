import { describe, it } from "vitest";
import { assertValid, assertInvalid } from "../../harness.ts";
import { noNullishCoalescing } from "../../../src/rules/ts/no-nullish-coalescing.ts";

describe("no-nullish-coalescing", () => {
  it("allows nullable ?? usage", () => {
    assertValid(noNullishCoalescing, new URL("./valid.ts", import.meta.url).pathname);
  });
  it("flags non-nullable ?? usage", () => {
    assertInvalid(noNullishCoalescing, new URL("./invalid.ts", import.meta.url).pathname);
  });
});
