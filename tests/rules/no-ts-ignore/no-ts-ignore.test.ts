import { describe, it } from "vitest";
import { assertValid, assertInvalid } from "../../harness.ts";
import { noTsIgnore } from "../../../src/rules/ts/no-ts-ignore.ts";

describe("no-ts-ignore", () => {
  it("allows normal comments", () => {
    assertValid(noTsIgnore, new URL("./valid.ts", import.meta.url).pathname);
  });
  it("flags @ts-ignore and @ts-expect-error", () => {
    assertInvalid(noTsIgnore, new URL("./invalid.ts", import.meta.url).pathname);
  });
});
