import { describe, it } from "vitest";
import { assertCrossFileValid, assertCrossFileInvalid } from "../../harness.ts";
import { repeatedReturnShape } from "../../../src/rules/cross-file/repeated-return-shape.ts";

describe("repeated-return-shape", () => {
  it("allows functions with different return shapes", () => {
    assertCrossFileValid(repeatedReturnShape, new URL("./valid", import.meta.url).pathname);
  });

  it("flags functions returning the same object shape", () => {
    assertCrossFileInvalid(repeatedReturnShape, new URL("./invalid", import.meta.url).pathname);
  });
});
