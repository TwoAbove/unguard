import { describe, it } from "vitest";
import { assertValid, assertInvalid } from "../../harness.ts";
import { noTsExpectError } from "../../../src/rules/ts/no-ts-expect-error.ts";

describe("no-ts-expect-error", () => {
  it("allows normal comments and @ts-ignore", () => {
    assertValid(noTsExpectError, new URL("./valid.ts", import.meta.url).pathname);
  });
  it("flags @ts-expect-error", () => {
    assertInvalid(noTsExpectError, new URL("./invalid.ts", import.meta.url).pathname);
  });
});
