import { describe, it } from "vitest";
import { assertCrossFileValid, assertCrossFileInvalid } from "../../harness.ts";
import { constantArgument } from "../../../src/rules/cross-file/constant-argument.ts";

describe("constant-argument", () => {
  it("allows parameters that actually vary", () => {
    assertCrossFileValid(constantArgument, new URL("./valid", import.meta.url).pathname);
  });
  it("flags parameters pinned to one literal everywhere", () => {
    assertCrossFileInvalid(constantArgument, new URL("./invalid", import.meta.url).pathname);
  });
});
