import { describe, it } from "vitest";
import { assertCrossFileInvalid, assertCrossFileValid } from "../../harness.ts";
import { nullableParamNeverNull } from "../../../src/rules/cross-file/nullable-param-never-null.ts";

describe("nullable-param-never-null", () => {
  it("allows nullable params that some caller can fill with null or undefined", () => {
    assertCrossFileValid(nullableParamNeverNull, new URL("./valid", import.meta.url).pathname);
  });

  it("flags nullable params no caller fills with null or undefined", () => {
    assertCrossFileInvalid(nullableParamNeverNull, new URL("./invalid", import.meta.url).pathname);
  });
});
