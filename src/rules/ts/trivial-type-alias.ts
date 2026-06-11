import * as ts from "typescript";
import type { TSRule, TSVisitContext } from "../types.ts";

/**
 * `type Foo = Bar` — a non-generic alias to another named type with no type
 * arguments is pure indirection: two names for one type, and every reader has
 * to chase the alias to learn nothing. Aliases that *do* carry information
 * are exempt by construction: primitives (`type ID = string` — keyword, not a
 * type reference), instantiations (`type Rows = Result<Row>`), and shapes
 * (unions, literals, mapped types).
 *
 * No autofix — removing the alias is a project-wide rename.
 *
 * Info, not warning: in real codebases roughly half of these aliases are
 * deliberate — parallel naming across a family (`AdminDeps = UserDeps` next
 * to branded siblings) or a domain boundary giving its own name to an
 * imported type. The other half are refactor leftovers. The rule can't tell
 * intent from structure, so it prompts review instead of demanding a fix.
 */
export const trivialTypeAlias: TSRule = {
  kind: "ts",
  id: "trivial-type-alias",
  severity: "info",
  message: "Type alias adds a second name for an existing type without changing it; use the original type",
  syntaxKinds: [ts.SyntaxKind.TypeAliasDeclaration],
  requiresTypeInfo: false,

  visit(node: ts.Node, ctx: TSVisitContext) {
    if (!ts.isTypeAliasDeclaration(node)) return;
    if (node.typeParameters !== undefined && node.typeParameters.length > 0) return;
    if (!ts.isTypeReferenceNode(node.type)) return;
    if (node.type.typeArguments !== undefined && node.type.typeArguments.length > 0) return;
    ctx.report(node);
  },
};
