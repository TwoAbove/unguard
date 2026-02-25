import { describe, it } from "vitest";
import { assertValid, assertInvalid } from "../../harness.ts";
import { noInlineTypeInParams } from "../../../src/rules/ts/no-inline-type-in-params.ts";

describe("no-inline-type-in-params", () => {
  it("allows named type references", () => {
    assertValid(noInlineTypeInParams, new URL("./valid.ts", import.meta.url).pathname);
  });
  it("flags inline type literals", () => {
    assertInvalid(noInlineTypeInParams, new URL("./invalid.ts", import.meta.url).pathname);
  });
});
