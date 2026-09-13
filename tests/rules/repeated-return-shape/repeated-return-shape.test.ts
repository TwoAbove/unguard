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

  it("allows explicit return contracts with methods, optional members, and union branches", () => {
    assertCrossFileValid(
      repeatedReturnShape,
      new URL("./explicit-annotations", import.meta.url).pathname,
    );
  });

  it("does not count annotated functions toward the repetition threshold", () => {
    assertCrossFileValid(
      repeatedReturnShape,
      new URL("./annotation-threshold", import.meta.url).pathname,
    );
  });

  it("reports unannotated nested functions despite annotated enclosing functions", () => {
    assertCrossFileInvalid(
      repeatedReturnShape,
      new URL("./nearest-function", import.meta.url).pathname,
    );
  });
});
