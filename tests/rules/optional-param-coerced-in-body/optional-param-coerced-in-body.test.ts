import { describe, it } from "vitest";
import { assertValid, assertInvalid } from "../../harness.ts";
import { optionalParamCoercedInBody } from "../../../src/rules/ts/optional-param-coerced-in-body.ts";

describe("optional-param-coerced-in-body", () => {
  it("allows honest parameter contracts", () => {
    assertValid(optionalParamCoercedInBody, new URL("./valid.ts", import.meta.url).pathname);
  });

  it("flags optional params that the body forces to non-optional", () => {
    assertInvalid(optionalParamCoercedInBody, new URL("./invalid.ts", import.meta.url).pathname);
  });
});
