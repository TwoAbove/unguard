import { describe, it } from "vitest";
import { assertCrossFileValid, assertCrossFileInvalid } from "../../harness.ts";
import { nearDuplicateFunction } from "../../../src/rules/cross-file/near-duplicate-function.ts";

describe("near-duplicate-function", () => {
  it("allows different function bodies", () => {
    assertCrossFileValid(nearDuplicateFunction, new URL("./valid", import.meta.url).pathname);
  });

  it("flags near-duplicate function bodies across files", () => {
    assertCrossFileInvalid(nearDuplicateFunction, new URL("./invalid", import.meta.url).pathname);
  });

  it("flags near-duplicate function bodies in same file", () => {
    assertCrossFileInvalid(nearDuplicateFunction, new URL("./invalid-same-file", import.meta.url).pathname);
  });

  it("flags this.x vs param.x as near-duplicates", () => {
    assertCrossFileInvalid(nearDuplicateFunction, new URL("./invalid-this-vs-param", import.meta.url).pathname);
  });
});
