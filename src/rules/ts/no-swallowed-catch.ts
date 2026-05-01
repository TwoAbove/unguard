import * as ts from "typescript";
import type { SemanticServices, TSRule, TSVisitContext } from "../types.ts";

export const noSwallowedCatch: TSRule = {
  kind: "ts",
  id: "no-swallowed-catch",
  severity: "warning",
  message:
    "Catch swallows the error: it neither throws nor returns a value referencing the caught error. Propagate via throw, or model failure into the return type carrying the original error",
  syntaxKinds: [ts.SyntaxKind.CatchClause, ts.SyntaxKind.CallExpression],

  visit(node: ts.Node, ctx: TSVisitContext) {
    if (ts.isCatchClause(node)) {
      const binding = identifierBindingName(node.variableDeclaration);
      if (handlesError(node.block, binding)) return;
      ctx.report(node);
      return;
    }

    if (ts.isCallExpression(node)) {
      const callee = node.expression;
      if (!ts.isPropertyAccessExpression(callee)) return;
      if (callee.name.text !== "catch") return;
      if (node.arguments.length !== 1) return;
      const handler = node.arguments[0];
      if (!handler) return;
      if (!ts.isArrowFunction(handler) && !ts.isFunctionExpression(handler)) return;

      const recvType = ctx.semantics.typeAtLocation(callee.expression);
      if (!isPromiseLike(recvType, ctx.semantics)) return;

      const binding = identifierBindingName(handler.parameters[0]);
      if (handlesError(handler.body, binding)) return;
      ctx.report(node);
    }
  },
};

function identifierBindingName(
  decl: ts.VariableDeclaration | ts.ParameterDeclaration | undefined,
): string | undefined {
  if (!decl) return undefined;
  if (!ts.isIdentifier(decl.name)) return undefined;
  return decl.name.text;
}

/** Treats catch/handler body as handled iff it throws somewhere, OR a return references the binding. */
function handlesError(body: ts.Node, binding: string | undefined): boolean {
  if (!ts.isBlock(body)) {
    return binding !== undefined && expressionReferencesBinding(body, binding);
  }
  return blockThrows(body) || (binding !== undefined && blockReturnsReferencingBinding(body, binding));
}

function blockThrows(body: ts.Block): boolean {
  return walkSkippingFunctions(body, (n) => ts.isThrowStatement(n));
}

function blockReturnsReferencingBinding(body: ts.Block, binding: string): boolean {
  return walkSkippingFunctions(body, (n) => {
    if (!ts.isReturnStatement(n)) return false;
    if (!n.expression) return false;
    return expressionReferencesBinding(n.expression, binding);
  });
}

function walkSkippingFunctions(root: ts.Node, predicate: (n: ts.Node) => boolean): boolean {
  let found = false;
  function walk(node: ts.Node): void {
    if (found) return;
    if (
      ts.isFunctionDeclaration(node) ||
      ts.isFunctionExpression(node) ||
      ts.isArrowFunction(node) ||
      ts.isMethodDeclaration(node)
    ) {
      return;
    }
    if (predicate(node)) {
      found = true;
      return;
    }
    ts.forEachChild(node, walk);
  }
  ts.forEachChild(root, walk);
  return found;
}

function expressionReferencesBinding(expr: ts.Node, binding: string): boolean {
  let found = false;
  function walk(node: ts.Node): void {
    if (found) return;
    if (
      ts.isFunctionDeclaration(node) ||
      ts.isFunctionExpression(node) ||
      ts.isArrowFunction(node) ||
      ts.isMethodDeclaration(node)
    ) {
      return;
    }
    if (ts.isIdentifier(node) && node.text === binding && isReferenceUse(node)) {
      found = true;
      return;
    }
    ts.forEachChild(node, walk);
  }
  walk(expr);
  return found;
}

function isReferenceUse(id: ts.Identifier): boolean {
  const parent = id.parent;
  if (!parent) return true;
  if (ts.isPropertyAccessExpression(parent) && parent.name === id) return false;
  if (ts.isPropertyAssignment(parent) && parent.name === id) return false;
  if (ts.isMethodDeclaration(parent) && parent.name === id) return false;
  if (ts.isQualifiedName(parent) && parent.right === id) return false;
  if (ts.isBindingElement(parent) && parent.propertyName === id) return false;
  if (ts.isParameter(parent) && parent.name === id) return false;
  if (ts.isVariableDeclaration(parent) && parent.name === id) return false;
  return true;
}

function isPromiseLike(type: ts.Type, semantics: SemanticServices): boolean {
  if (hasThenMethod(type, semantics)) return true;
  if (type.isUnion()) return type.types.some((t) => isPromiseLike(t, semantics));
  if (type.isIntersection()) return type.types.some((t) => isPromiseLike(t, semantics));
  return false;
}

function hasThenMethod(type: ts.Type, semantics: SemanticServices): boolean {
  const apparent = semantics.apparentType(type);
  const then = apparent.getProperty("then");
  if (!then) return false;
  const declaration = then.valueDeclaration ?? then.declarations?.[0];
  if (!declaration) return false;
  const thenType = semantics.typeOfSymbolAtLocation(then, declaration);
  return thenType.getCallSignatures().length > 0;
}
