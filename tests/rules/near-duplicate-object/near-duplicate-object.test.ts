import { describe, it } from "vitest";
import { assertCrossFileValid, assertCrossFileInvalid } from "../../harness.ts";
import { nearDuplicateObject } from "../../../src/rules/cross-file/near-duplicate-object.ts";

describe("near-duplicate-object", () => {
  it("excludes a single wrapped function from data-only construction matching", () => {
    assertCrossFileValid(nearDuplicateObject, new URL("./valid/wrapped-function", import.meta.url).pathname);
  });

  it("preserves parenthesized static computed property keys", () => {
    assertCrossFileValid(nearDuplicateObject, new URL("./valid/computed-keys", import.meta.url).pathname);
  });

  it("treats differently interpolated diagnostic messages as per-instance values", () => {
    assertCrossFileInvalid(nearDuplicateObject, new URL("./invalid/template-messages", import.meta.url).pathname);
  });

  it("flags compact data projections at five accesses without a method size floor", () => {
    assertCrossFileInvalid(nearDuplicateObject, new URL("./invalid/data-projection", import.meta.url).pathname);
  });

  it("reports only the maximal repeated nested data construction", () => {
    assertCrossFileInvalid(nearDuplicateObject, new URL("./invalid/nested-data", import.meta.url).pathname);
  });

  it("allows data constructions below five accesses or calls", () => {
    assertCrossFileValid(nearDuplicateObject, new URL("./valid/tiny-data", import.meta.url).pathname);
  });

  it("allows metadata-heavy configurations with only tiny callbacks", () => {
    assertCrossFileValid(nearDuplicateObject, new URL("./valid/metadata-heavy", import.meta.url).pathname);
  });

  it("flags repeated wiring objects with renamed references and different literals", () => {
    assertCrossFileInvalid(nearDuplicateObject, new URL("./invalid/wiring", import.meta.url).pathname);
  });

  it("matches renamed bindings independently across method scopes", () => {
    assertCrossFileInvalid(nearDuplicateObject, new URL("./invalid/shadowing", import.meta.url).pathname);
  });

  it("flags templates containing arrow properties and accessors", () => {
    assertCrossFileInvalid(nearDuplicateObject, new URL("./invalid/arrow-accessor", import.meta.url).pathname);
  });

  it("allows identical dependencies imported under different aliases", () => {
    assertCrossFileValid(nearDuplicateObject, new URL("./valid/aliases", import.meta.url).pathname);
  });

  it("allows shared factories with data-only configurations", () => {
    assertCrossFileValid(nearDuplicateObject, new URL("./valid/factored", import.meta.url).pathname);
  });

  it("allows objects with different function bodies", () => {
    assertCrossFileValid(nearDuplicateObject, new URL("./valid/different", import.meta.url).pathname);
  });

  it("distinguishes unary operators with the same AST node kind", () => {
    assertCrossFileValid(nearDuplicateObject, new URL("./valid/unary-operators", import.meta.url).pathname);
  });

  it("preserves repeated versus distinct free-reference relationships", () => {
    assertCrossFileValid(nearDuplicateObject, new URL("./valid/reference-consistency", import.meta.url).pathname);
  });

  it("allows a single nontrivial wiring object", () => {
    assertCrossFileValid(nearDuplicateObject, new URL("./valid/single", import.meta.url).pathname);
  });

  it("allows tiny objects even with two function members", () => {
    assertCrossFileValid(nearDuplicateObject, new URL("./valid/tiny", import.meta.url).pathname);
  });
});
