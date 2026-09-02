import { describe, it } from "vitest";
import { assertCrossFileValid, assertCrossFileInvalid } from "../../harness.ts";
import { redundantConditionalSpread } from "../../../src/rules/cross-file/redundant-conditional-spread.ts";

const dir = (name: string): string => new URL(`./${name}`, import.meta.url).pathname;

describe("redundant-conditional-spread", () => {
  it("flags laundering into project types no code observes; a local function named `keys` is not an observer", () => {
    assertCrossFileInvalid(redundantConditionalSpread, dir("invalid-strict"));
  });

  it("under exactOptionalPropertyTypes: flags widened and mapped-widened targets, stays silent where the compiler forces the guard", () => {
    assertCrossFileInvalid(redundantConditionalSpread, dir("invalid-eopt"));
  });

  it("stays silent when any code checks the key with `in`", () => {
    assertCrossFileValid(redundantConditionalSpread, dir("valid-observed-in"));
  });

  it("stays silent when another file iterates the type with for...in, even if never called from the site", () => {
    assertCrossFileValid(redundantConditionalSpread, dir("valid-observed-forin-cross-file"));
  });

  it("stays silent when the built object is a later spread operand over defaults", () => {
    assertCrossFileValid(redundantConditionalSpread, dir("valid-observed-merge"));
  });

  it("stays silent when an earlier sibling spread provides the key (merge protection)", () => {
    assertCrossFileValid(redundantConditionalSpread, dir("valid-merge-protection"));
  });

  it("stays silent when the object escapes into an external function", () => {
    assertCrossFileValid(redundantConditionalSpread, dir("valid-escape-external"));
  });

  it("stays silent when the object is JSX-spread", () => {
    assertCrossFileValid(redundantConditionalSpread, dir("valid-escape-jsx"));
  });

  it("follows type flow through in-project calls to reach an observer", () => {
    assertCrossFileValid(redundantConditionalSpread, dir("valid-flow-edge"));
  });

  it("stays silent when a rest pattern carries the keys onward", () => {
    assertCrossFileValid(redundantConditionalSpread, dir("valid-rest-pattern"));
  });
});
