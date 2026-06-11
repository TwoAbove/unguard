import { describe, it } from "vitest";
import { assertValid, assertInvalid } from "../../harness.ts";
import { noCoalesceUndefined } from "../../../src/rules/ts/no-coalesce-undefined.ts";

describe("no-coalesce-undefined", () => {
  it("allows null normalization and real fallbacks", () => {
    assertValid(noCoalesceUndefined, new URL("./valid.ts", import.meta.url).pathname);
  });
  it("flags identity ?? undefined", () => {
    assertInvalid(noCoalesceUndefined, new URL("./invalid.ts", import.meta.url).pathname);
  });
});
