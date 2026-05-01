import type * as ts from "typescript";
import type { SemanticServices } from "../rules/types.ts";

export class SemanticCache implements SemanticServices {
  private readonly typesAtLocation = new WeakMap<ts.Node, ts.Type>();
  private readonly symbolsAtLocation = new WeakMap<ts.Node, ts.Symbol | null>();
  private readonly resolvedSignatures = new WeakMap<ts.CallLikeExpression, ts.Signature | null>();
  private readonly typesFromTypeNodes = new WeakMap<ts.TypeNode, ts.Type>();
  private readonly contextualTypes = new WeakMap<ts.Expression, ts.Type | null>();
  private readonly typesOfSymbols = new WeakMap<ts.Symbol, WeakMap<ts.Node, ts.Type>>();
  private readonly aliasedSymbols = new WeakMap<ts.Symbol, ts.Symbol>();
  private readonly awaitedTypes = new WeakMap<ts.Type, ts.Type | null>();
  private readonly apparentTypes = new WeakMap<ts.Type, ts.Type>();
  private readonly arrayTypes = new WeakMap<ts.Type, boolean>();
  private readonly tupleTypes = new WeakMap<ts.Type, boolean>();
  private readonly assignability = new WeakMap<ts.Type, WeakMap<ts.Type, boolean>>();

  constructor(readonly checker: ts.TypeChecker) {}

  typeAtLocation(node: ts.Node): ts.Type {
    const cached = this.typesAtLocation.get(node);
    if (cached !== undefined) return cached;
    const type = this.checker.getTypeAtLocation(node);
    this.typesAtLocation.set(node, type);
    return type;
  }

  symbolAtLocation(node: ts.Node): ts.Symbol | undefined {
    const cached = this.symbolsAtLocation.get(node);
    if (cached !== undefined) return cached ?? undefined;
    const symbol = this.checker.getSymbolAtLocation(node);
    this.symbolsAtLocation.set(node, symbol ?? null);
    return symbol;
  }

  resolvedSignature(node: ts.CallLikeExpression): ts.Signature | undefined {
    const cached = this.resolvedSignatures.get(node);
    if (cached !== undefined) return cached ?? undefined;
    const signature = this.checker.getResolvedSignature(node);
    this.resolvedSignatures.set(node, signature ?? null);
    return signature;
  }

  typeFromTypeNode(node: ts.TypeNode): ts.Type {
    const cached = this.typesFromTypeNodes.get(node);
    if (cached !== undefined) return cached;
    const type = this.checker.getTypeFromTypeNode(node);
    this.typesFromTypeNodes.set(node, type);
    return type;
  }

  contextualType(node: ts.Expression): ts.Type | undefined {
    const cached = this.contextualTypes.get(node);
    if (cached !== undefined) return cached ?? undefined;
    const type = this.checker.getContextualType(node);
    this.contextualTypes.set(node, type ?? null);
    return type;
  }

  typeOfSymbolAtLocation(symbol: ts.Symbol, node: ts.Node): ts.Type {
    let byNode = this.typesOfSymbols.get(symbol);
    if (byNode === undefined) {
      byNode = new WeakMap();
      this.typesOfSymbols.set(symbol, byNode);
    }
    const cached = byNode.get(node);
    if (cached !== undefined) return cached;
    const type = this.checker.getTypeOfSymbolAtLocation(symbol, node);
    byNode.set(node, type);
    return type;
  }

  aliasedSymbol(symbol: ts.Symbol): ts.Symbol {
    const cached = this.aliasedSymbols.get(symbol);
    if (cached !== undefined) return cached;
    const aliased = this.checker.getAliasedSymbol(symbol);
    this.aliasedSymbols.set(symbol, aliased);
    return aliased;
  }

  awaitedType(type: ts.Type): ts.Type | undefined {
    const cached = this.awaitedTypes.get(type);
    if (cached !== undefined) return cached ?? undefined;
    const awaited = this.checker.getAwaitedType(type);
    this.awaitedTypes.set(type, awaited ?? null);
    return awaited;
  }

  apparentType(type: ts.Type): ts.Type {
    const cached = this.apparentTypes.get(type);
    if (cached !== undefined) return cached;
    const apparent = this.checker.getApparentType(type);
    this.apparentTypes.set(type, apparent);
    return apparent;
  }

  isArrayType(type: ts.Type): boolean {
    const cached = this.arrayTypes.get(type);
    if (cached !== undefined) return cached;
    const result = this.checker.isArrayType(type);
    this.arrayTypes.set(type, result);
    return result;
  }

  isTupleType(type: ts.Type): boolean {
    const cached = this.tupleTypes.get(type);
    if (cached !== undefined) return cached;
    const result = this.checker.isTupleType(type);
    this.tupleTypes.set(type, result);
    return result;
  }

  isTypeAssignableTo(source: ts.Type, target: ts.Type): boolean {
    let byTarget = this.assignability.get(source);
    if (byTarget === undefined) {
      byTarget = new WeakMap();
      this.assignability.set(source, byTarget);
    }
    const cached = byTarget.get(target);
    if (cached !== undefined) return cached;
    const result = this.checker.isTypeAssignableTo(source, target);
    byTarget.set(target, result);
    return result;
  }
}
