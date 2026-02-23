import { describe, it } from "vitest";
import { assertValid, assertInvalid } from "../../harness.ts";
import { noNullishCoalescing } from "../../../src/rules/single-file/no-nullish-coalescing.ts";

describe("no-nullish-coalescing", () => {
  it("allows non-nullish operators", () => {
    assertValid(noNullishCoalescing, new URL("./valid.ts", import.meta.url).pathname);
  });
  it("flags nullish coalescing", () => {
    assertInvalid(noNullishCoalescing, new URL("./invalid.ts", import.meta.url).pathname);
  });
});
