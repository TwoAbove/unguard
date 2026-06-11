import { describe, it } from "vitest";
import { assertValid, assertInvalid } from "../../harness.ts";
import { redundantBooleanBranch } from "../../../src/rules/ts/redundant-boolean-branch.ts";

describe("redundant-boolean-branch", () => {
  it("allows coercions and branches that do real work", () => {
    assertValid(redundantBooleanBranch, new URL("./valid.ts", import.meta.url).pathname);
  });
  it("flags branches that restate a boolean condition", () => {
    assertInvalid(redundantBooleanBranch, new URL("./invalid.ts", import.meta.url).pathname);
  });
});
