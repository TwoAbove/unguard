import { describe, it } from "vitest";
import { assertCrossFileValid, assertCrossFileInvalid } from "../../harness.ts";
import { duplicateStatementSequence } from "../../../src/rules/cross-file/duplicate-statement-sequence.ts";

describe("duplicate-statement-sequence", () => {
  it("allows different statement sequences", () => {
    assertCrossFileValid(duplicateStatementSequence, new URL("./valid", import.meta.url).pathname);
  });

  it("flags identical statement sequences", () => {
    assertCrossFileInvalid(duplicateStatementSequence, new URL("./invalid", import.meta.url).pathname);
  });
});
