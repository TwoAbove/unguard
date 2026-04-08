import * as ts from "typescript";
import type { TSRule, TSVisitContext } from "../types.ts";

function containsTypeLiteral(type: ts.TypeNode): boolean {
  if (ts.isTypeLiteralNode(type)) return true;
  if (ts.isArrayTypeNode(type)) return containsTypeLiteral(type.elementType);
  if (ts.isTypeReferenceNode(type) && type.typeArguments) {
    return type.typeArguments.some(containsTypeLiteral);
  }
  if (ts.isTypeOperatorNode(type)) return containsTypeLiteral(type.type);
  return false;
}

export const noInlineTypeAssertion: TSRule = {
  kind: "ts",
  id: "no-inline-type-assertion",
  severity: "error",
  message: "Type assertion contains inline object type; extract a named type or fix the upstream type",

  visit(node: ts.Node, ctx: TSVisitContext) {
    if (ts.isAsExpression(node) && containsTypeLiteral(node.type)) {
      ctx.report(node);
      return;
    }

    if (ts.isTypeAssertionExpression(node) && containsTypeLiteral(node.type)) {
      ctx.report(node);
    }
  },
};
