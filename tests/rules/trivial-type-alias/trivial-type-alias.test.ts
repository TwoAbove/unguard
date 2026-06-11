import { describe, it } from "vitest";
import { assertValid, assertInvalid } from "../../harness.ts";
import { trivialTypeAlias } from "../../../src/rules/ts/trivial-type-alias.ts";

describe("trivial-type-alias", () => {
  it("allows aliases that carry structure or specialization", () => {
    assertValid(trivialTypeAlias, new URL("./valid.ts", import.meta.url).pathname);
  });
  it("flags bare renames of existing types", () => {
    assertInvalid(trivialTypeAlias, new URL("./invalid.ts", import.meta.url).pathname);
  });
});
