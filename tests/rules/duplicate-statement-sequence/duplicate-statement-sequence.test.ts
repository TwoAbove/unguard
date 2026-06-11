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

  it("does not flag lookup/dispatch tables that vary only by literal data", () => {
    assertCrossFileValid(duplicateStatementSequence, new URL("./valid-lookup-table", import.meta.url).pathname);
  });

  it("flags duplicated sequences even when only comments differ", () => {
    assertCrossFileInvalid(duplicateStatementSequence, new URL("./invalid-with-comments", import.meta.url).pathname);
  });
});
