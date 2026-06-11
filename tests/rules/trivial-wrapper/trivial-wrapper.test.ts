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

  it("does not flag wrappers that specialize a type predicate", () => {
    assertCrossFileValid(trivialWrapper, new URL("./valid-type-predicate", import.meta.url).pathname);
  });

  it("does not flag wrappers that introduce their own generics", () => {
    assertCrossFileValid(trivialWrapper, new URL("./valid-generic-specializing", import.meta.url).pathname);
  });

  it("does not flag partial-application wrappers", () => {
    assertCrossFileValid(trivialWrapper, new URL("./valid-partial-application", import.meta.url).pathname);
  });

  it("does not flag wrappers that reorder arguments", () => {
    assertCrossFileValid(trivialWrapper, new URL("./valid-reordering", import.meta.url).pathname);
  });
});
