import { describe, it } from "vitest";
import { assertValid, assertInvalid } from "../../harness.ts";
import { returnTypeWidensViaDestructure } from "../../../src/rules/ts/return-type-widens-via-destructure.ts";

describe("return-type-widens-via-destructure", () => {
  it("allows destructure when the return type is honest about widening", () => {
    assertValid(returnTypeWidensViaDestructure, new URL("./valid.ts", import.meta.url).pathname);
  });

  it("flags returns of destructured array elements when the return type doesn't admit undefined", () => {
    assertInvalid(returnTypeWidensViaDestructure, new URL("./invalid.ts", import.meta.url).pathname);
  });
});
