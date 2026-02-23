import { describe, it } from "vitest";
import { assertCrossFileValid, assertCrossFileInvalid } from "../../harness.ts";
import { explicitNullArg } from "../../../src/rules/cross-file/explicit-null-arg.ts";

describe("explicit-null-arg", () => {
  it("allows calls without nullish args", () => {
    assertCrossFileValid(explicitNullArg, new URL("./valid", import.meta.url).pathname);
  });

  it("flags explicit null/undefined passed to project functions", () => {
    assertCrossFileInvalid(explicitNullArg, new URL("./invalid", import.meta.url).pathname);
  });
});
