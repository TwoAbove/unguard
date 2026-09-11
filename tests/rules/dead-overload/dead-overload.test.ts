import { describe, it } from "vitest";
import { assertCrossFileInvalid, assertCrossFileValid } from "../../harness.ts";
import { deadOverload } from "../../../src/rules/cross-file/dead-overload.ts";

describe("dead-overload", () => {
  it("flags overloads with no matching local call sites", () => {
    assertCrossFileInvalid(deadOverload, new URL("./invalid", import.meta.url).pathname);
  });

  it("allows overload families where multiple signatures are used", () => {
    assertCrossFileValid(deadOverload, new URL("./valid", import.meta.url).pathname);
  });

  it("allows overload families with no local call sites", () => {
    assertCrossFileValid(deadOverload, new URL("./valid-no-local-calls", import.meta.url).pathname);
  });

  it.each(["private-method", "protected-method", "class-expression"])(
    "flags the unused signature in a %s overload family",
    (fixture) => {
      assertCrossFileInvalid(
        deadOverload,
        new URL(`./invalid-${fixture}`, import.meta.url).pathname,
      );
    },
  );

  it.each(["private-method", "protected-method", "class-expression"])(
    "allows a %s overload family when both signatures are called",
    (fixture) => {
      assertCrossFileValid(
        deadOverload,
        new URL(`./valid-${fixture}`, import.meta.url).pathname,
      );
    },
  );
});
