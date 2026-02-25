import { describe, it } from "vitest";
import { assertValid, assertInvalid } from "../../harness.ts";
import { noOptionalCall } from "../../../src/rules/ts/no-optional-call.ts";

describe("no-optional-call", () => {
  it("allows nullable optional call", () => {
    assertValid(noOptionalCall, new URL("./valid.ts", import.meta.url).pathname);
  });
  it("flags non-nullable optional call", () => {
    assertInvalid(noOptionalCall, new URL("./invalid.ts", import.meta.url).pathname);
  });
});
