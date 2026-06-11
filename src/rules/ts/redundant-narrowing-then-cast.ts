import * as ts from "typescript";
import type { TSRule, TSVisitContext } from "../types.ts";

/**
 * Cast inside a narrowed branch whose target is something the narrowing
 * already established. After the narrowing, the type checker already knows
 * the value satisfies the cast's target type — the cast adds nothing.
 *
 * Builds on top of `no-non-null-assertion` and `no-type-assertion`: those
 * eliminate the escape-hatch casts, and what remains is genuine "I had to
 * cast" — sometimes legitimate (subclass narrowing inside an instanceof
 * branch), sometimes a missed narrowing.
 */
export const redundantNarrowingThenCast: TSRule = {
  kind: "ts",
  id: "redundant-narrowing-then-cast",
  severity: "warning",
  message:
    "Cast is redundant: the surrounding narrowing already established this type. Drop the cast.",
  syntaxKinds: [ts.SyntaxKind.AsExpression, ts.SyntaxKind.TypeAssertionExpression],

  visit(node: ts.Node, ctx: TSVisitContext) {
    if (!ts.isAsExpression(node) && !ts.isTypeAssertionExpression(node)) return;

    // skip `as const`
    if (ts.isTypeReferenceNode(node.type) && node.type.getText(ctx.sourceFile).trim() === "const") return;

    // The cast must apply to an identifier or property-access whose root symbol
    // was the subject of the narrowing.
    const castSubject = node.expression;
    const subjectExpr = leftmostExpression(castSubject);
    if (subjectExpr === null) return;

    // The narrowed type at the cast's subject position (TS computed it from the
    // narrowing) must already be assignable to the cast's target type.
    const narrowedType = ctx.semantics.typeAtLocation(castSubject);
    if ((narrowedType.flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown)) !== 0) return;
    const targetType = ctx.semantics.typeFromTypeNode(node.type);
    if (!ctx.semantics.isTypeAssignableTo(narrowedType, targetType)) return;

    const fix = {
      start: node.getStart(ctx.sourceFile),
      end: node.getEnd(),
      text: castSubject.getText(ctx.sourceFile),
    };

    // Path 1 — flow-proven, any narrowing construct (early return, else
    // branch, switch, assignment): the subject is a bare identifier whose
    // flow type satisfies the target while its declared type does not. The
    // type difference is itself the proof that narrowing already happened.
    if (ts.isIdentifier(castSubject)) {
      const symbol = ctx.semantics.symbolAtLocation(castSubject);
      const declaration = symbol?.valueDeclaration;
      if (symbol !== undefined && declaration !== undefined) {
        const declaredType = ctx.checker.getTypeOfSymbolAtLocation(symbol, declaration);
        if (!ctx.semantics.isTypeAssignableTo(declaredType, targetType)) {
          ctx.report(node, undefined, fix);
          return;
        }
      }
    }

    // Path 2 — property chains: confirm an enclosing if-test narrowed the
    // chain's root symbol. Without this, casts on unrelated identifiers
    // inside a branch could spuriously match.
    const enclosingIf = findEnclosingIfWithThen(node);
    if (enclosingIf === null) return;
    const subjectSymbol = ctx.semantics.symbolAtLocation(subjectExpr);
    if (subjectSymbol === undefined) return;
    if (!testNarrowsSymbol(enclosingIf.expression, subjectSymbol, ctx)) return;

    ctx.report(node, undefined, fix);
  },
};

/** Walk ancestors. Returns the enclosing IfStatement iff the node is inside its then-branch. */
function findEnclosingIfWithThen(node: ts.Node): ts.IfStatement | null {
  let current: ts.Node = node;
  while (current.parent) {
    const parent: ts.Node = current.parent;
    if (ts.isIfStatement(parent)) {
      if (parent.thenStatement === current) return parent;
      // Inside the else-branch: the narrowing doesn't apply.
      return null;
    }
    current = parent;
  }
  return null;
}

/** Get the leftmost identifier-or-`this`-rooted expression of a property chain. */
function leftmostExpression(expr: ts.Expression): ts.Expression | null {
  let current: ts.Expression = expr;
  while (ts.isPropertyAccessExpression(current)) {
    current = current.expression;
  }
  if (ts.isIdentifier(current)) return current;
  if (current.kind === ts.SyntaxKind.ThisKeyword) return current;
  return null;
}

/**
 * True when the if-test narrows `symbol`. Structural patterns recognized:
 *   - `typeof X === ...` / `typeof X !== ...`
 *   - `X instanceof Y`
 *   - `X === null/undefined`, `X !== null/undefined`, `X == null`, `X != null`
 *   - bare `X` (truthy)
 *   - bare `!X` (falsy — but we're in the then-branch of a positive guard; falsy
 *     check's then-branch goes to the else side, so we don't accept this)
 *   - `&&`/`||` chains containing any of the above on `symbol`
 */
function testNarrowsSymbol(test: ts.Expression, symbol: ts.Symbol, ctx: TSVisitContext): boolean {
  if (matchesSymbol(test, symbol, ctx)) return true;
  if (ts.isParenthesizedExpression(test)) return testNarrowsSymbol(test.expression, symbol, ctx);
  if (ts.isBinaryExpression(test)) {
    const op = test.operatorToken.kind;
    if (op === ts.SyntaxKind.AmpersandAmpersandToken || op === ts.SyntaxKind.BarBarToken) {
      return testNarrowsSymbol(test.left, symbol, ctx) || testNarrowsSymbol(test.right, symbol, ctx);
    }
    if (isEqualityOp(op)) {
      return matchesSymbol(test.left, symbol, ctx) || matchesSymbol(test.right, symbol, ctx);
    }
    if (op === ts.SyntaxKind.InstanceOfKeyword) {
      return matchesSymbol(test.left, symbol, ctx);
    }
  }
  if (ts.isTypeOfExpression(test)) {
    return matchesSymbol(test.expression, symbol, ctx);
  }
  return false;
}

function matchesSymbol(expr: ts.Expression, symbol: ts.Symbol, ctx: TSVisitContext): boolean {
  if (ts.isTypeOfExpression(expr)) {
    return matchesSymbol(expr.expression, symbol, ctx);
  }
  if (ts.isParenthesizedExpression(expr)) {
    return matchesSymbol(expr.expression, symbol, ctx);
  }
  const root = leftmostExpression(expr);
  if (root === null) return false;
  const rootSymbol = ctx.semantics.symbolAtLocation(root);
  return rootSymbol === symbol;
}

function isEqualityOp(op: ts.SyntaxKind): boolean {
  return (
    op === ts.SyntaxKind.EqualsEqualsEqualsToken ||
    op === ts.SyntaxKind.ExclamationEqualsEqualsToken ||
    op === ts.SyntaxKind.EqualsEqualsToken ||
    op === ts.SyntaxKind.ExclamationEqualsToken
  );
}
