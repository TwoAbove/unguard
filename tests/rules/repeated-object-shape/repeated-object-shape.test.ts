import { describe, it } from "vitest";
import { assertCrossFileValid, assertCrossFileInvalid } from "../../harness.ts";
import { repeatedObjectShape } from "../../../src/rules/cross-file/repeated-object-shape.ts";

describe("repeated-object-shape", () => {
  it("allows shapes below threshold", () => {
    assertCrossFileValid(repeatedObjectShape, new URL("./valid", import.meta.url).pathname);
  });

  it("flags repeated object shapes", () => {
    assertCrossFileInvalid(repeatedObjectShape, new URL("./invalid", import.meta.url).pathname);
  });
});
