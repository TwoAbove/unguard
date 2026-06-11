import * as ts from "typescript";
import type { TSRule, TSVisitContext } from "../types.ts";
import { isPromiseLike } from "../../typecheck/utils.ts";

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

/**
 * Treats catch/handler body as handled iff one of:
 *  - body throws (rethrow / wrap-and-throw)
 *  - a return references the binding (carried into the return shape)
 *  - the binding is passed as an argument to some call (handed off to a sink)
 */
function handlesError(body: ts.Node, binding: string | undefined): boolean {
  if (!ts.isBlock(body)) {
    return binding !== undefined && expressionReferencesBinding(body, binding);
  }
  if (blockThrows(body)) return true;
  if (binding === undefined) return false;
  if (blockReturnsReferencingBinding(body, binding)) return true;
  return blockPassesBindingToCall(body, binding);
}

/**
 * True when some CallExpression in the body has an argument tree that references
 * the catch binding. The structural claim: a call that takes the error as an
 * argument is contracted to do something with it (log, capture, report, wrap,
 * transform). We trust the call's contract — same trust we extend to returns.
 *
 * Walks the body excluding nested function scopes (those would have their own
 * catch/return semantics for the binding).
 */
function blockPassesBindingToCall(body: ts.Block, binding: string): boolean {
  return walkSkippingFunctions(body, (n) => {
    if (!ts.isCallExpression(n)) return false;
    return n.arguments.some((arg) => expressionReferencesBinding(arg, binding));
  });
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
    if (ts.isBlock(node) || ts.isSourceFile(node)) {
      for (const stmt of node.statements) {
        walk(stmt);
        if (found || statementTerminates(stmt)) return;
      }
      return;
    }
    ts.forEachChild(node, walk);
  }
  walk(root);
  return found;
}

function statementTerminates(stmt: ts.Statement): boolean {
  if (ts.isReturnStatement(stmt) || ts.isThrowStatement(stmt)) return true;
  if (!ts.isIfStatement(stmt)) return false;
  if (stmt.elseStatement === undefined) return false;
  return branchTerminates(stmt.thenStatement) && branchTerminates(stmt.elseStatement);
}

function branchTerminates(stmt: ts.Statement): boolean {
  if (statementTerminates(stmt)) return true;
  if (!ts.isBlock(stmt)) return false;
  const last = stmt.statements.at(-1);
  return last !== undefined && statementTerminates(last);
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
  const parent: ts.Node | undefined = id.parent;
  if (!parent) return true;
  if (ts.isPropertyAccessExpression(parent) && parent.name === id) return false;
  if (ts.isPropertyAssignment(parent) && parent.name === id) return false;
  if (ts.isMethodDeclaration(parent) && parent.name === id) return false;
  if (ts.isQualifiedName(parent) && parent.right === id) return false;
  if (ts.isBindingElement(parent) && parent.propertyName === id) return false;
  if (ts.isParameter(parent) && parent.name === id) return false;
  return !(ts.isVariableDeclaration(parent) && parent.name === id);
}
