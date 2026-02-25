import { describe, it } from "vitest";
import { assertValid, assertInvalid } from "../../harness.ts";
import { noDynamicImport } from "../../../src/rules/ts/no-dynamic-import.ts";

describe("no-dynamic-import", () => {
  it("allows static imports", () => {
    assertValid(noDynamicImport, new URL("./valid.ts", import.meta.url).pathname);
  });

  it("flags dynamic import() expressions", () => {
    assertInvalid(noDynamicImport, new URL("./invalid.ts", import.meta.url).pathname);
  });
});
