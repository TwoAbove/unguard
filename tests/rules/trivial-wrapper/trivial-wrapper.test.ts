import { describe, it } from "vitest";
import { assertCrossFileValid, assertCrossFileInvalid } from "../../harness.ts";
import { trivialWrapper } from "../../../src/rules/cross-file/trivial-wrapper.ts";

describe("trivial-wrapper", () => {
  it("allows functions that transform arguments", () => {
    assertCrossFileValid(trivialWrapper, new URL("./valid", import.meta.url).pathname);
  });

  it("flags trivial wrappers that delegate without transformation", () => {
    assertCrossFileInvalid(trivialWrapper, new URL("./invalid", import.meta.url).pathname);
  });
});
