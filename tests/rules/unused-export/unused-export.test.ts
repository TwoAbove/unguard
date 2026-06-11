import { describe, it } from "vitest";
import { assertCrossFileValid, assertCrossFileInvalid } from "../../harness.ts";
import { unusedExport } from "../../../src/rules/cross-file/unused-export.ts";

describe("unused-export", () => {
  it("allows exported functions that are imported and used", () => {
    assertCrossFileValid(unusedExport, new URL("./valid", import.meta.url).pathname);
  });

  it("flags exported functions with no usages from other files", () => {
    assertCrossFileInvalid(unusedExport, new URL("./invalid", import.meta.url).pathname);
  });

  it("does not flag default-exported functions imported via default import", () => {
    assertCrossFileValid(unusedExport, new URL("./valid-default-import", import.meta.url).pathname);
  });

  it("does not flag default exports when consumer renames the local binding", () => {
    assertCrossFileValid(unusedExport, new URL("./valid-renamed-default-import", import.meta.url).pathname);
  });

  it("does not let a default import alias hide an unrelated named export", () => {
    assertCrossFileInvalid(unusedExport, new URL("./invalid-default-alias-collision", import.meta.url).pathname);
  });

  it("flags unused exported types and constants, allows imported or same-file-used ones", () => {
    assertCrossFileInvalid(unusedExport, new URL("./invalid-types-constants", import.meta.url).pathname);
  });

  it("treats a namespace import as using every export of the target file", () => {
    assertCrossFileValid(unusedExport, new URL("./valid-namespace-import", import.meta.url).pathname);
  });

  it("resolves tsconfig path-alias imports through the checker", () => {
    assertCrossFileValid(unusedExport, new URL("./valid-alias-import", import.meta.url).pathname);
  });
});
