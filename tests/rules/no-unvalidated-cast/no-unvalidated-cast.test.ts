import { describe, it } from "vitest";
import { assertInvalid, assertValid } from "../../harness.ts";
import { noUnvalidatedCast } from "../../../src/rules/ts/no-unvalidated-cast.ts";

describe("no-unvalidated-cast", () => {
  it("allows branded types, primitives, and validated casts", () => {
    assertValid(noUnvalidatedCast, new URL("./valid.ts", import.meta.url).pathname);
  });

  it("flags unvalidated casts from any/unknown to concrete types", () => {
    assertInvalid(noUnvalidatedCast, new URL("./invalid.ts", import.meta.url).pathname);
  });
});
