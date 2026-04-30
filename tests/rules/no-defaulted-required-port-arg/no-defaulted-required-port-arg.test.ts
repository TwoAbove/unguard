import { describe, it } from "vitest";
import { assertValid, assertInvalid } from "../../harness.ts";
import { noDefaultedRequiredPortArg } from "../../../src/rules/ts/no-defaulted-required-port-arg.ts";

describe("no-defaulted-required-port-arg", () => {
  it("allows defaults that match the interface contract", () => {
    assertValid(noDefaultedRequiredPortArg, new URL("./valid.ts", import.meta.url).pathname);
  });
  it("flags defaults on params the interface declares required", () => {
    assertInvalid(noDefaultedRequiredPortArg, new URL("./invalid.ts", import.meta.url).pathname);
  });
});
