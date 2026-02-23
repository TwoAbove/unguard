import { describe, it } from "vitest";
import { assertValid, assertInvalid } from "../../harness.ts";
import { noDoubleNegationCoercion } from "../../../src/rules/single-file/no-double-negation-coercion.ts";

describe("no-double-negation-coercion", () => {
  it("allows single negation", () => {
    assertValid(noDoubleNegationCoercion, new URL("./valid.ts", import.meta.url).pathname);
  });
  it("flags double negation", () => {
    assertInvalid(noDoubleNegationCoercion, new URL("./invalid.ts", import.meta.url).pathname);
  });
});
