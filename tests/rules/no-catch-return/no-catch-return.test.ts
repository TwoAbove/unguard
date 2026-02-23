import { describe, it } from "vitest";
import { assertValid, assertInvalid } from "../../harness.ts";
import { noCatchReturn } from "../../../src/rules/single-file/no-catch-return.ts";

describe("no-catch-return", () => {
  it("allows catch with throw or side effects", () => {
    assertValid(noCatchReturn, new URL("./valid.ts", import.meta.url).pathname);
  });

  it("flags catch blocks that return without throwing", () => {
    assertInvalid(noCatchReturn, new URL("./invalid.ts", import.meta.url).pathname);
  });
});
