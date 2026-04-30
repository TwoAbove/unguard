import { describe, it } from "vitest";
import { assertValid, assertInvalid } from "../../harness.ts";
import { noSwallowedCatch } from "../../../src/rules/ts/no-swallowed-catch.ts";

describe("no-swallowed-catch", () => {
  it("allows catches that propagate via throw or return-the-error", () => {
    assertValid(noSwallowedCatch, new URL("./valid.ts", import.meta.url).pathname);
  });
  it("flags catches that swallow the error", () => {
    assertInvalid(noSwallowedCatch, new URL("./invalid.ts", import.meta.url).pathname);
  });
});
