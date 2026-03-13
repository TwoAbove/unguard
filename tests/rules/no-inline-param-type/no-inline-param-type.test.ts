import { describe, it } from "vitest";
import { assertInvalid, assertValid } from "../../harness.ts";
import { noInlineParamType } from "../../../src/rules/ts/no-inline-param-type.ts";

describe("no-inline-param-type", () => {
  it("allows named and primitive param types", () => {
    assertValid(noInlineParamType, new URL("./valid.ts", import.meta.url).pathname);
  });

  it("flags inline object type annotations on parameters", () => {
    assertInvalid(noInlineParamType, new URL("./invalid.ts", import.meta.url).pathname);
  });
});
