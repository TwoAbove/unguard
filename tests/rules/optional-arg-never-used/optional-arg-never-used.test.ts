import { describe, it } from "vitest";
import { assertCrossFileValid, assertCrossFileInvalid } from "../../harness.ts";
import { optionalArgNeverUsed } from "../../../src/rules/cross-file/optional-arg-never-used.ts";

describe("optional-arg-never-used", () => {
  it("allows optionals that are sometimes provided or unknowable", () => {
    assertCrossFileValid(optionalArgNeverUsed, new URL("./valid", import.meta.url).pathname);
  });
  it("flags optionals no call site ever provides", () => {
    assertCrossFileInvalid(optionalArgNeverUsed, new URL("./invalid", import.meta.url).pathname);
  });
});
