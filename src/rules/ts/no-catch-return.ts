import * as ts from "typescript";
import type { TSRule, TSVisitContext } from "../types.ts";

export const noCatchReturn: TSRule = {
  kind: "ts",
  id: "no-catch-return",
  severity: "warning",
  message:
    "Catch block silently returns a fallback value with no logging; rethrow, log the error, or let it propagate",

  visit(node: ts.Node, ctx: TSVisitContext) {
    if (!ts.isCatchClause(node)) return;
    const block = node.block;
    if (hasReturn(block) && !hasThrow(block) && !hasLogging(block)) {
      ctx.report(node);
    }
  },
};

function walkBlock(block: ts.Block, predicate: (node: ts.Node) => boolean): boolean {
  function visit(node: ts.Node): boolean {
    if (predicate(node)) return true;
    if (ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node) || ts.isArrowFunction(node)) return false;
    return ts.forEachChild(node, visit) ?? false;
  }
  return ts.forEachChild(block, visit) ?? false;
}

function hasReturn(block: ts.Block): boolean {
  return walkBlock(block, (n) => ts.isReturnStatement(n));
}

function hasThrow(block: ts.Block): boolean {
  return walkBlock(block, (n) => ts.isThrowStatement(n));
}

const LOG_OBJECTS = new Set(["console", "logger", "log"]);

function hasLogging(block: ts.Block): boolean {
  return walkBlock(block, (n) => {
    if (!ts.isCallExpression(n)) return false;
    const callee = n.expression;
    if (!ts.isPropertyAccessExpression(callee)) return false;
    if (!ts.isIdentifier(callee.expression)) return false;
    return LOG_OBJECTS.has(callee.expression.text);
  });
}
