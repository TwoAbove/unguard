import { describe, it } from "vitest";
import { assertCrossFileInvalid, assertCrossFileValid } from "../../harness.ts";
import { returnValueNeverUsed } from "../../../src/rules/cross-file/return-value-never-used.ts";

describe("return-value-never-used", () => {
  it("allows returns some caller reads, or that carry no value at the call", () => {
    assertCrossFileValid(returnValueNeverUsed, new URL("./valid", import.meta.url).pathname);
  });

  it("flags returns every caller discards", () => {
    assertCrossFileInvalid(returnValueNeverUsed, new URL("./invalid", import.meta.url).pathname);
  });
});
