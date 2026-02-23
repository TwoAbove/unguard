import { describe, it } from "vitest";
import { assertValid, assertInvalid } from "../../harness.ts";
import { noLogicalOrFallback } from "../../../src/rules/single-file/no-logical-or-fallback.ts";

describe("no-logical-or-fallback", () => {
  it("allows || with non-literal right", () => {
    assertValid(noLogicalOrFallback, new URL("./valid.ts", import.meta.url).pathname);
  });
  it("flags || with literal fallback", () => {
    assertInvalid(noLogicalOrFallback, new URL("./invalid.ts", import.meta.url).pathname);
  });
});
