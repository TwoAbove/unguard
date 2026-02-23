import { describe, it } from "vitest";
import { assertValid, assertInvalid } from "../../harness.ts";
import { noErrorRewrap } from "../../../src/rules/single-file/no-error-rewrap.ts";

describe("no-error-rewrap", () => {
  it("allows rethrow and wrap-with-cause", () => {
    assertValid(noErrorRewrap, new URL("./valid.ts", import.meta.url).pathname);
  });

  it("flags re-wrapped errors without cause", () => {
    assertInvalid(noErrorRewrap, new URL("./invalid.ts", import.meta.url).pathname);
  });
});
