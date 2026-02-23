import { describe, it } from "vitest";
import { assertValid, assertInvalid } from "../../harness.ts";
import { noAnyCast } from "../../../src/rules/single-file/no-any-cast.ts";

describe("no-any-cast", () => {
  it("allows non-any casts", () => {
    assertValid(noAnyCast, new URL("./valid.ts", import.meta.url).pathname);
  });
  it("flags as any casts", () => {
    assertInvalid(noAnyCast, new URL("./invalid.ts", import.meta.url).pathname);
  });
});
