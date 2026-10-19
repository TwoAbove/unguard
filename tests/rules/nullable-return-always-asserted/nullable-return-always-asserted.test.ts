import { describe, it } from "vitest";
import { assertCrossFileInvalid, assertCrossFileValid } from "../../harness.ts";
import { nullableReturnAlwaysAsserted } from "../../../src/rules/cross-file/nullable-return-always-asserted.ts";

describe("nullable-return-always-asserted", () => {
  it("allows nullable returns some caller handles, defaults or checks later", () => {
    assertCrossFileValid(nullableReturnAlwaysAsserted, new URL("./valid", import.meta.url).pathname);
  });

  it("flags nullable returns every caller asserts or throws on", () => {
    assertCrossFileInvalid(nullableReturnAlwaysAsserted, new URL("./invalid", import.meta.url).pathname);
  });
});
