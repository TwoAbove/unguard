import { describe, it } from "vitest";
import { assertValid, assertInvalid } from "../../harness.ts";
import { noDoubleNegationCoercion } from "../../../src/rules/ts/no-double-negation-coercion.ts";

describe("no-double-negation-coercion", () => {
  it("allows single negation and Boolean()", () => {
    assertValid(noDoubleNegationCoercion, new URL("./valid.ts", import.meta.url).pathname);
  });
  it("flags double negation", () => {
    assertInvalid(noDoubleNegationCoercion, new URL("./invalid.ts", import.meta.url).pathname);
  });
});
