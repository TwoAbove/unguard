import * as ts from "typescript";
import type { TSRule, TSVisitContext } from "../types.ts";

export const noErrorRewrap: TSRule = {
  kind: "ts",
  id: "no-error-rewrap",
  severity: "error",
  message:
    "Re-wrapped error loses the original stack trace and type; use { cause: originalError } to preserve the error chain",
  syntaxKinds: [ts.SyntaxKind.CatchClause],
  requiresTypeInfo: false,

  visit(node: ts.Node, ctx: TSVisitContext) {
    if (!ts.isCatchClause(node)) return;
    if (!node.variableDeclaration) return;
    const param = node.variableDeclaration.name;
    if (!ts.isIdentifier(param)) return;
    const catchName = param.text;
    findRewraps(node.block, catchName, ctx);
  },
};

function findRewraps(block: ts.Block, catchName: string, ctx: TSVisitContext): void {
  function visit(node: ts.Node): void {
    if (ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node) || ts.isArrowFunction(node)) return;
    if (ts.isThrowStatement(node) && node.expression && ts.isNewExpression(node.expression)) {
      const args = node.expression.arguments;
      if (args && args.length > 0 && referencesName(args, catchName) && !hasCauseArg(args)) {
        ctx.report(node);
      }
      return;
    }
    ts.forEachChild(node, visit);
  }
  ts.forEachChild(block, visit);
}

function referencesName(args: readonly ts.Expression[], name: string): boolean {
  for (const arg of args) {
    if (containsIdentifier(arg, name)) return true;
  }
  return false;
}

function containsIdentifier(node: ts.Node, name: string): boolean {
  if (ts.isIdentifier(node) && node.text === name) return true;
  return ts.forEachChild(node, (child) => containsIdentifier(child, name) || undefined) ?? false;
}

function hasCauseArg(args: readonly ts.Expression[]): boolean {
  for (const arg of args) {
    if (ts.isObjectLiteralExpression(arg)) {
      for (const prop of arg.properties) {
        if (ts.isPropertyAssignment(prop) && ts.isIdentifier(prop.name) && prop.name.text === "cause") return true;
        if (ts.isShorthandPropertyAssignment(prop) && prop.name.text === "cause") return true;
      }
    }
  }
  return false;
}
