import { describe, it } from "vitest";
import { assertValid, assertInvalid } from "../../harness.ts";
import { noDeadNarrowing } from "../../../src/rules/ts/no-dead-narrowing.ts";

describe("no-dead-narrowing", () => {
  it("allows conditions the types cannot decide", () => {
    assertValid(noDeadNarrowing, new URL("./valid.ts", import.meta.url).pathname);
  });
  it("flags conditions statically decided by the types", () => {
    assertInvalid(noDeadNarrowing, new URL("./invalid.ts", import.meta.url).pathname);
  });
  it("suppresses truthiness verdicts without noUncheckedIndexedAccess", () => {
    assertValid(noDeadNarrowing, new URL("./unchecked-index/valid.ts", import.meta.url).pathname);
  });
});
