import { describe, it } from "vitest";
import { assertValid, assertInvalid } from "../../harness.ts";
import { noModuleStateWrite } from "../../../src/rules/ts/no-module-state-write.ts";

describe("no-module-state-write", () => {
  it("allows local and parameter mutation", () => {
    assertValid(noModuleStateWrite, new URL("./valid.ts", import.meta.url).pathname);
  });

  it("flags writes to module-scope state from inside functions", () => {
    assertInvalid(noModuleStateWrite, new URL("./invalid.ts", import.meta.url).pathname);
  });
});
