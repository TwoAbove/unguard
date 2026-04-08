import { describe, it } from "vitest";
import { assertInvalid, assertValid } from "../../harness.ts";
import { noRedundantCast } from "../../../src/rules/ts/no-redundant-cast.ts";

describe("no-redundant-cast", () => {
  it("allows narrowing and branded casts", () => {
    assertValid(noRedundantCast, new URL("./valid.ts", import.meta.url).pathname);
  });

  it("flags redundant type assertions", () => {
    assertInvalid(noRedundantCast, new URL("./invalid.ts", import.meta.url).pathname);
  });
});
