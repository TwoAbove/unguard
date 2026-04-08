import { describe, it } from "vitest";
import { assertInvalid, assertValid } from "../../harness.ts";
import { noNeverCast } from "../../../src/rules/ts/no-never-cast.ts";

describe("no-never-cast", () => {
  it("allows non-never assertions", () => {
    assertValid(noNeverCast, new URL("./valid.ts", import.meta.url).pathname);
  });

  it("flags as never", () => {
    assertInvalid(noNeverCast, new URL("./invalid.ts", import.meta.url).pathname);
  });
});
