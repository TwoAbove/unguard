import * as ts from "typescript";
import type { TSRule, TSVisitContext } from "../types.ts";

/**
 * `const { a = 1 } = obj` where `obj.a` can never be undefined: the default
 * is dead code, same family as `no-nullish-coalescing` but in binding-pattern
 * position. Object patterns only — array destructuring is governed by
 * `noUncheckedIndexedAccess` and tuple arity, handled elsewhere. Only direct
 * destructuring of a typed source (annotated parameter, or variable with an
 * initializer/annotation) is checked.
 */
export const redundantDestructureDefault: TSRule = {
  kind: "ts",
  id: "redundant-destructure-default",
  severity: "warning",
  message: "Destructuring default can never apply: the property's type does not include undefined",
  syntaxKinds: [ts.SyntaxKind.BindingElement],
  requiresStrictNullChecks: true,

  visit(node: ts.Node, ctx: TSVisitContext) {
    if (!ts.isBindingElement(node)) return;
    if (node.initializer === undefined) return;
    const pattern = node.parent;
    if (!ts.isObjectBindingPattern(pattern)) return;

    const sourceType = destructuredSourceType(pattern, ctx);
    if (sourceType === null) return;
    if (sourceType.flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown | ts.TypeFlags.Instantiable)) return;

    const propertyName = node.propertyName ?? node.name;
    if (!ts.isIdentifier(propertyName)) return;
    const property = sourceType.getProperty(propertyName.text);
    if (property === undefined) return;
    if (property.flags & ts.SymbolFlags.Optional) return;

    const propertyType = ctx.checker.getTypeOfSymbolAtLocation(property, node);
    const parts = propertyType.isUnion() ? propertyType.types : [propertyType];
    const undecidable = ts.TypeFlags.Any | ts.TypeFlags.Unknown | ts.TypeFlags.Instantiable;
    if (parts.some((p) => (p.flags & undecidable) !== 0)) return;
    if (parts.some((p) => (p.flags & (ts.TypeFlags.Undefined | ts.TypeFlags.Void)) !== 0)) return;

    ctx.report(node, undefined, {
      start: node.name.getEnd(),
      end: node.initializer.getEnd(),
      text: "",
    });
  },
};

/** The declared type of the value being destructured, when statically known. */
function destructuredSourceType(pattern: ts.ObjectBindingPattern, ctx: TSVisitContext): ts.Type | null {
  const holder = pattern.parent;
  if (ts.isVariableDeclaration(holder)) {
    if (holder.type !== undefined) return ctx.semantics.typeFromTypeNode(holder.type);
    if (holder.initializer !== undefined) return ctx.semantics.typeAtLocation(holder.initializer);
    return null;
  }
  if (ts.isParameter(holder)) {
    if (holder.type !== undefined) return ctx.semantics.typeFromTypeNode(holder.type);
    return null;
  }
  return null;
}
