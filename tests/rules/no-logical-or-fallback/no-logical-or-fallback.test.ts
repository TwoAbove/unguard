import { describe, it } from "vitest";
import { assertValid, assertInvalid } from "../../harness.ts";
import { noLogicalOrFallback } from "../../../src/rules/ts/no-logical-or-fallback.ts";

describe("no-logical-or-fallback", () => {
  it("allows safe || patterns", () => {
    assertValid(noLogicalOrFallback, new URL("./valid.ts", import.meta.url).pathname);
  });
  it("flags || with literal fallback on data-structure lookups", () => {
    assertInvalid(noLogicalOrFallback, new URL("./invalid.ts", import.meta.url).pathname);
  });
});
