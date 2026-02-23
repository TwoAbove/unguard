import { describe, it } from "vitest";
import { assertValid, assertInvalid } from "../../harness.ts";
import { noEmptyCatch } from "../../../src/rules/single-file/no-empty-catch.ts";

describe("no-empty-catch", () => {
  it("allows catch with body", () => {
    assertValid(noEmptyCatch, new URL("./valid.ts", import.meta.url).pathname);
  });

  it("flags empty catch blocks", () => {
    assertInvalid(noEmptyCatch, new URL("./invalid.ts", import.meta.url).pathname);
  });
});
