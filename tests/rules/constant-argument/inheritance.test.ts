import { describe, it } from "vitest";
import { constantArgument } from "../../../src/rules/cross-file/constant-argument.ts";
import { optionalArgAlwaysUsed } from "../../../src/rules/cross-file/optional-arg-always-used.ts";
import { optionalArgNeverUsed } from "../../../src/rules/cross-file/optional-arg-never-used.ts";
import { assertCrossFileInvalid, assertCrossFileValid } from "../../harness.ts";

const fixtures = new URL("./inheritance", import.meta.url).pathname;

describe("inherited caller contracts", () => {
  it("preserves virtual signatures while reporting unrelated derived methods", () => {
    assertCrossFileInvalid(constantArgument, fixtures);
  });

  it("does not require an optional argument omitted by a base-typed caller", () => {
    assertCrossFileValid(optionalArgAlwaysUsed, fixtures);
  });

  it("does not remove an optional argument supplied by a base-typed caller", () => {
    assertCrossFileValid(optionalArgNeverUsed, fixtures);
  });
});
