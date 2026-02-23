import { describe, it } from "vitest";
import { assertValid, assertInvalid } from "../../harness.ts";
import { noExplicitAnyAnnotation } from "../../../src/rules/single-file/no-explicit-any-annotation.ts";

describe("no-explicit-any-annotation", () => {
  it("allows non-any annotations", () => {
    assertValid(noExplicitAnyAnnotation, new URL("./valid.ts", import.meta.url).pathname);
  });
  it("flags any annotations", () => {
    assertInvalid(noExplicitAnyAnnotation, new URL("./invalid.ts", import.meta.url).pathname);
  });
});
