import * as ts from "typescript";
import type { TSRule, TSVisitContext } from "../types.ts";

export const noDefaultedRequiredPortArg: TSRule = {
  kind: "ts",
  id: "no-defaulted-required-port-arg",
  severity: "warning",
  message:
    "Default value on a parameter the implemented interface declares required; the implementation widens the contract — drop the default or change the interface",
  syntaxKinds: [ts.SyntaxKind.MethodDeclaration],

  visit(node: ts.Node, ctx: TSVisitContext) {
    if (!ts.isMethodDeclaration(node)) return;
    if (!ts.isIdentifier(node.name)) return;
    if (node.parameters.every((p) => p.initializer === undefined)) return;

    const ifaceSignatures = resolveImplementedSignatures(node, ctx);
    if (ifaceSignatures.length === 0) return;

    for (let i = 0; i < node.parameters.length; i++) {
      const implParam = node.parameters[i];
      if (!implParam || implParam.initializer === undefined) continue;
      if (implParam.dotDotDotToken !== undefined) continue;
      if (ifaceSignatures.some((sig) => isParamRequired(sig, i))) {
        ctx.report(implParam);
      }
    }
  },
};

function isParamRequired(sig: ts.Signature, paramIndex: number): boolean {
  const param = sig.parameters[paramIndex];
  if (!param) return false;
  const decl = param.valueDeclaration;
  if (!decl || !ts.isParameter(decl)) return false;
  if (decl.questionToken !== undefined) return false;
  if (decl.initializer !== undefined) return false;
  if (decl.dotDotDotToken !== undefined) return false;
  return true;
}

function resolveImplementedSignatures(
  method: ts.MethodDeclaration,
  ctx: TSVisitContext,
): ts.Signature[] {
  const signatures: ts.Signature[] = [];
  if (!ts.isIdentifier(method.name)) return signatures;
  const methodName = method.name.text;
  const parent = method.parent;

  if (ts.isClassDeclaration(parent) || ts.isClassExpression(parent)) {
    for (const clause of parent.heritageClauses ?? []) {
      if (clause.token !== ts.SyntaxKind.ImplementsKeyword) continue;
      for (const typeNode of clause.types) {
        collectSignatures(typeNode, methodName, ctx, signatures);
      }
    }
  } else if (ts.isObjectLiteralExpression(parent)) {
    const contextualType = ctx.semantics.contextualType(parent);
    if (contextualType) {
      collectSignaturesFromType(contextualType, methodName, parent, ctx, signatures);
    }
  }

  return signatures;
}

function collectSignatures(
  typeNode: ts.Node,
  methodName: string,
  ctx: TSVisitContext,
  out: ts.Signature[],
): void {
  const t = ctx.semantics.typeAtLocation(typeNode);
  collectSignaturesFromType(t, methodName, typeNode, ctx, out);
}

function collectSignaturesFromType(
  type: ts.Type,
  methodName: string,
  location: ts.Node,
  ctx: TSVisitContext,
  out: ts.Signature[],
): void {
  const prop = type.getProperty(methodName);
  if (!prop) return;
  const propType = ctx.semantics.typeOfSymbolAtLocation(prop, location);
  for (const sig of propType.getCallSignatures()) {
    out.push(sig);
  }
}
