import * as ts from "typescript";
import type { TSRule, TSVisitContext } from "../types.ts";
import { includesUndefined } from "../../typecheck/utils.ts";

/**
 * EXPERIMENTAL — `{ ...base, key: value }` where `base` definitely provides
 * `key` and `value` may be `undefined`.
 *
 * When the value is absent the merge silently erases the value the spread
 * carried — the one real bug conditional-spread ceremony exists to prevent.
 * This flags the hazard itself instead of guessing about the ceremony.
 *
 * Skips literal `undefined` overwrites (a deliberate clear), values whose type
 * excludes `undefined` (including `??`-guarded and non-null-asserted ones),
 * and bases that only optionally provide the key (no guaranteed value to
 * lose). Fires on both `key: value` and shorthand `key` forms.
 */
export const noUndefinedClobber: TSRule = {
  kind: "ts",
  id: "no-undefined-clobber",
  severity: "warning",
  message:
    "overwrites a value the earlier spread guarantees with a possibly-undefined one; when absent this erases data — guard with `...(v === undefined ? {} : { v })` or default with `??`",

  syntaxKinds: [ts.SyntaxKind.ObjectLiteralExpression],

  visit(node: ts.Node, ctx: TSVisitContext) {
    if (!ts.isObjectLiteralExpression(node)) return;

    const spreads: ts.SpreadAssignment[] = [];
    for (const prop of node.properties) {
      if (ts.isSpreadAssignment(prop)) {
        spreads.push(prop);
        continue;
      }
      if (spreads.length === 0) continue;

      const overwrite = matchOverwrite(prop);
      if (overwrite === null) continue;
      if (!includesUndefined(ctx.checker.getTypeAtLocation(overwrite.value))) continue;

      for (const spread of spreads) {
        const baseType = ctx.checker.getTypeAtLocation(spread.expression);
        const baseProp = baseType.getProperty(overwrite.key);
        if (baseProp === undefined) continue;
        if ((baseProp.flags & ts.SymbolFlags.Optional) !== 0) continue;
        const basePropType = ctx.checker.getTypeOfSymbolAtLocation(baseProp, spread.expression);
        if (includesUndefined(basePropType)) continue;
        ctx.report(prop);
        break;
      }
    }
  },
};

interface Overwrite {
  key: string;
  value: ts.Expression;
}

/**
 * A property that can overwrite a spread-provided key with a runtime
 * `undefined`. Literal-valued and function-valued assignments are excluded
 * up front so the common case never touches the checker.
 */
function matchOverwrite(prop: ts.ObjectLiteralElementLike): Overwrite | null {
  if (ts.isShorthandPropertyAssignment(prop)) {
    return { key: prop.name.text, value: prop.name };
  }
  if (!ts.isPropertyAssignment(prop)) return null;
  if (!ts.isIdentifier(prop.name) && !ts.isStringLiteral(prop.name)) return null;
  if (neverUndefinedSyntax(prop.initializer)) return null;
  if (ts.isIdentifier(prop.initializer) && prop.initializer.text === "undefined") return null;
  return { key: prop.name.text, value: prop.initializer };
}

/** Syntactic forms that cannot evaluate to `undefined`; skip before any checker call. */
function neverUndefinedSyntax(expr: ts.Expression): boolean {
  switch (expr.kind) {
    case ts.SyntaxKind.StringLiteral:
    case ts.SyntaxKind.NumericLiteral:
    case ts.SyntaxKind.BigIntLiteral:
    case ts.SyntaxKind.TemplateExpression:
    case ts.SyntaxKind.NoSubstitutionTemplateLiteral:
    case ts.SyntaxKind.TrueKeyword:
    case ts.SyntaxKind.FalseKeyword:
    case ts.SyntaxKind.NullKeyword:
    case ts.SyntaxKind.ObjectLiteralExpression:
    case ts.SyntaxKind.ArrayLiteralExpression:
    case ts.SyntaxKind.ArrowFunction:
    case ts.SyntaxKind.FunctionExpression:
    case ts.SyntaxKind.NewExpression:
    case ts.SyntaxKind.NonNullExpression:
      return true;
    default:
      return false;
  }
}

