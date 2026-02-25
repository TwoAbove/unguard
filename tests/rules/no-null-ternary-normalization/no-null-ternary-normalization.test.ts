import { describe, it } from "vitest";
import { assertValid, assertInvalid } from "../../harness.ts";
import { noNullTernaryNormalization } from "../../../src/rules/ts/no-null-ternary-normalization.ts";

describe("no-null-ternary-normalization", () => {
  it("allows normal ternaries", () => {
    assertValid(noNullTernaryNormalization, new URL("./valid.ts", import.meta.url).pathname);
  });
  it("flags null-normalizing ternaries", () => {
    assertInvalid(noNullTernaryNormalization, new URL("./invalid.ts", import.meta.url).pathname);
  });
});
