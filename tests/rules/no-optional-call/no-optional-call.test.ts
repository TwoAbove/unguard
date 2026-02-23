import { describe, it } from "vitest";
import { assertValid, assertInvalid } from "../../harness.ts";
import { noOptionalCall } from "../../../src/rules/single-file/no-optional-call.ts";

describe("no-optional-call", () => {
  it("allows normal calls", () => {
    assertValid(noOptionalCall, new URL("./valid.ts", import.meta.url).pathname);
  });
  it("flags optional calls", () => {
    assertInvalid(noOptionalCall, new URL("./invalid.ts", import.meta.url).pathname);
  });
});
