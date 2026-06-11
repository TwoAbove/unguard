import { describe, it } from "vitest";
import { assertValid, assertInvalid } from "../../harness.ts";
import { redundantNarrowingThenCast } from "../../../src/rules/ts/redundant-narrowing-then-cast.ts";

describe("redundant-narrowing-then-cast", () => {
  it("allows casts that add information the narrowing didn't establish", () => {
    assertValid(redundantNarrowingThenCast, new URL("./valid.ts", import.meta.url).pathname);
  });

  it("flags casts that re-state what the surrounding narrowing already proved", () => {
    assertInvalid(redundantNarrowingThenCast, new URL("./invalid.ts", import.meta.url).pathname);
  });
});
