import { describe, it } from "vitest";
import { assertValid, assertInvalid } from "../../harness.ts";
import { redundantDestructureDefault } from "../../../src/rules/ts/redundant-destructure-default.ts";

describe("redundant-destructure-default", () => {
  it("allows defaults on optional or undefined-able properties", () => {
    assertValid(redundantDestructureDefault, new URL("./valid.ts", import.meta.url).pathname);
  });
  it("flags defaults that can never apply", () => {
    assertInvalid(redundantDestructureDefault, new URL("./invalid.ts", import.meta.url).pathname);
  });
});
