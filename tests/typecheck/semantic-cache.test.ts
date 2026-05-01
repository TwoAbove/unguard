import type * as ts from "typescript";
import { describe, expect, it } from "vitest";
import { SemanticCache } from "../../src/typecheck/semantic-cache.ts";

describe("SemanticCache", () => {
  it("reuses type lookups for the same node", () => {
    const node = {} as ts.Node;
    const type = {} as ts.Type;
    let calls = 0;
    const checker = {
      getTypeAtLocation(input: ts.Node) {
        calls++;
        expect(input).toBe(node);
        return type;
      },
    } as unknown as ts.TypeChecker;

    const cache = new SemanticCache(checker);

    expect(cache.typeAtLocation(node)).toBe(type);
    expect(cache.typeAtLocation(node)).toBe(type);
    expect(calls).toBe(1);
  });

  it("reuses missing symbol lookups for the same node", () => {
    const node = {} as ts.Node;
    let calls = 0;
    const checker = {
      getSymbolAtLocation(input: ts.Node) {
        calls++;
        expect(input).toBe(node);
        return undefined;
      },
    } as unknown as ts.TypeChecker;

    const cache = new SemanticCache(checker);

    expect(cache.symbolAtLocation(node)).toBeUndefined();
    expect(cache.symbolAtLocation(node)).toBeUndefined();
    expect(calls).toBe(1);
  });

  it("reuses assignability for the same type pair", () => {
    const source = {} as ts.Type;
    const target = {} as ts.Type;
    let calls = 0;
    const checker = {
      isTypeAssignableTo(inputSource: ts.Type, inputTarget: ts.Type) {
        calls++;
        expect(inputSource).toBe(source);
        expect(inputTarget).toBe(target);
        return true;
      },
    } as unknown as ts.TypeChecker;

    const cache = new SemanticCache(checker);

    expect(cache.isTypeAssignableTo(source, target)).toBe(true);
    expect(cache.isTypeAssignableTo(source, target)).toBe(true);
    expect(calls).toBe(1);
  });
});
