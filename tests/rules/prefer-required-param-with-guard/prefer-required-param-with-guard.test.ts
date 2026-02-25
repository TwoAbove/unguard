import { describe, it } from "vitest";
import { assertValid, assertInvalid } from "../../harness.ts";
import { preferRequiredParamWithGuard } from "../../../src/rules/ts/prefer-required-param-with-guard.ts";

describe("prefer-required-param-with-guard", () => {
  it("allows required params with guards and optional without guards", () => {
    assertValid(preferRequiredParamWithGuard, new URL("./valid.ts", import.meta.url).pathname);
  });
  it("flags optional params with immediate guard", () => {
    assertInvalid(preferRequiredParamWithGuard, new URL("./invalid.ts", import.meta.url).pathname);
  });
});
