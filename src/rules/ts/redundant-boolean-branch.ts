import * as ts from "typescript";
import type { FixEdit, TSRule, TSVisitContext } from "../types.ts";

/**
 * `if (cond) return true; return false;` and `cond ? true : false` restate a
 * condition that is already a boolean. Only fires when the condition's type is
 * boolean — on any other type the branch performs a coercion, which is a
 * legitimate (if inelegant) operation owned by other rules.
 */
export const redundantBooleanBranch: TSRule = {
  kind: "ts",
  id: "redundant-boolean-branch",
  severity: "warning",
  message: "Branch restates an already-boolean condition; return the expression directly",
  syntaxKinds: [ts.SyntaxKind.ConditionalExpression, ts.SyntaxKind.IfStatement],

  visit(node: ts.Node, ctx: TSVisitContext) {
    if (ts.isConditionalExpression(node)) {
      checkTernary(node, ctx);
      return;
    }
    if (ts.isIfStatement(node)) {
      checkIfReturn(node, ctx);
    }
  },
};

function checkTernary(node: ts.ConditionalExpression, ctx: TSVisitContext): void {
  const whenTrue = booleanLiteralValue(node.whenTrue);
  const whenFalse = booleanLiteralValue(node.whenFalse);
  if (whenTrue === null || whenFalse === null || whenTrue === whenFalse) return;
  if (!isBooleanOnly(ctx.semantics.typeAtLocation(node.condition))) return;
  if (whenTrue === false && !isCleanlyNegatable(node.condition)) return;

  ctx.report(node, undefined, {
    start: node.getStart(ctx.sourceFile),
    end: node.getEnd(),
    text: conditionText(node.condition, whenTrue === false, ctx),
  });
}

function checkIfReturn(node: ts.IfStatement, ctx: TSVisitContext): void {
  const thenValue = returnedBooleanLiteral(node.thenStatement);
  if (thenValue === null) return;

  let elseValue: boolean | null = null;
  let fixEnd: number | null = null;
  if (node.elseStatement !== undefined) {
    elseValue = returnedBooleanLiteral(node.elseStatement);
    fixEnd = node.getEnd();
  } else {
    const next = nextSiblingStatement(node);
    if (next === undefined) return;
    elseValue = returnedBooleanLiteral(next);
    fixEnd = next.getEnd();
  }
  if (elseValue === null || elseValue === thenValue) return;
  if (!isBooleanOnly(ctx.semantics.typeAtLocation(node.expression))) return;
  if (thenValue === false && !isCleanlyNegatable(node.expression)) return;

  const fix: FixEdit = {
    start: node.getStart(ctx.sourceFile),
    end: fixEnd,
    text: `return ${conditionText(node.expression, thenValue === false, ctx)};`,
  };
  ctx.report(node, undefined, fix);
}

function nextSiblingStatement(node: ts.IfStatement): ts.Statement | undefined {
  const parent = node.parent;
  if (!ts.isBlock(parent) && !ts.isSourceFile(parent)) return undefined;
  const statements = parent.statements;
  const index = statements.indexOf(node);
  if (index === -1) return undefined;
  return statements[index + 1];
}

/** The boolean literal a statement returns: `return true;` or `{ return true; }`. */
function returnedBooleanLiteral(stmt: ts.Statement): boolean | null {
  if (ts.isBlock(stmt)) {
    if (stmt.statements.length !== 1) return null;
    const only = stmt.statements[0];
    if (only === undefined) return null;
    return returnedBooleanLiteral(only);
  }
  if (!ts.isReturnStatement(stmt) || stmt.expression === undefined) return null;
  return booleanLiteralValue(stmt.expression);
}

function booleanLiteralValue(expr: ts.Expression): boolean | null {
  if (expr.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (expr.kind === ts.SyntaxKind.FalseKeyword) return false;
  return null;
}

function isBooleanOnly(type: ts.Type): boolean {
  const parts = type.isUnion() ? type.types : [type];
  return parts.every((part) => (part.flags & ts.TypeFlags.BooleanLike) !== 0);
}

/**
 * Inverted branches (`if (cond) return false; return true;`) only count as
 * redundant when `!cond` stays readable. Synthesizing `!(a && b)` from a
 * compound condition trades an idiomatic guard clause for a parse puzzle —
 * that direction is left alone.
 */
function isCleanlyNegatable(condition: ts.Expression): boolean {
  return ts.isIdentifier(condition) || ts.isPropertyAccessExpression(condition) || ts.isCallExpression(condition);
}

function conditionText(condition: ts.Expression, negate: boolean, ctx: TSVisitContext): string {
  const text = condition.getText(ctx.sourceFile);
  if (!negate) return text;
  return `!${text}`;
}
