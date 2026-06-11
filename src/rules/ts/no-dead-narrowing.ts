import * as ts from "typescript";
import type { TSRule, TSVisitContext } from "../types.ts";

/**
 * Narrowing constructs whose outcome the types already decide: truthiness
 * checks on always-truthy values, typeof comparisons that can only go one
 * way, instanceof on a value whose class already extends the target, and
 * type-predicate calls whose argument is already of the predicate type.
 * These are the literal "defensive checks for impossible states" — the
 * branch (or its absence) is dead code.
 *
 * Only condition positions are examined (if/while/do/for/ternary tests and
 * the operands of !/&&/|| within them); a boolean produced for a typed slot
 * is not a narrowing.
 */
export const noDeadNarrowing: TSRule = {
  kind: "ts",
  id: "no-dead-narrowing",
  severity: "warning",
  message: "Condition is statically decided by the operand's type; the check is dead code",
  syntaxKinds: [
    ts.SyntaxKind.IfStatement,
    ts.SyntaxKind.WhileStatement,
    ts.SyntaxKind.DoStatement,
    ts.SyntaxKind.ForStatement,
    ts.SyntaxKind.ConditionalExpression,
  ],
  requiresStrictNullChecks: true,

  visit(node: ts.Node, ctx: TSVisitContext) {
    const condition = conditionOf(node);
    if (condition === undefined) return;
    checkCondition(condition, ctx);
  },
};

function conditionOf(node: ts.Node): ts.Expression | undefined {
  if (ts.isIfStatement(node) || ts.isWhileStatement(node) || ts.isDoStatement(node)) {
    return node.expression;
  }
  if (ts.isForStatement(node)) return node.condition;
  if (ts.isConditionalExpression(node)) return node.condition;
  return undefined;
}

/** Decompose `!`/`&&`/`||`/parens and check each atomic test. */
function checkCondition(expr: ts.Expression, ctx: TSVisitContext): void {
  if (ts.isParenthesizedExpression(expr)) {
    checkCondition(expr.expression, ctx);
    return;
  }
  if (ts.isPrefixUnaryExpression(expr) && expr.operator === ts.SyntaxKind.ExclamationToken) {
    checkCondition(expr.operand, ctx);
    return;
  }
  if (ts.isBinaryExpression(expr)) {
    const op = expr.operatorToken.kind;
    if (op === ts.SyntaxKind.AmpersandAmpersandToken || op === ts.SyntaxKind.BarBarToken) {
      checkCondition(expr.left, ctx);
      checkCondition(expr.right, ctx);
      return;
    }
    checkTypeofComparison(expr, ctx);
    checkInstanceof(expr, ctx);
    return;
  }
  if (ts.isCallExpression(expr)) {
    checkPredicateCall(expr, ctx);
    return;
  }
  if (ts.isIdentifier(expr) || ts.isPropertyAccessExpression(expr)) {
    checkTruthiness(expr, ctx);
  }
}

// ---------- (a) truthiness ----------

function checkTruthiness(expr: ts.Expression, ctx: TSVisitContext): void {
  // Without noUncheckedIndexedAccess, every value that flowed through an
  // index read (`rows[0]`, `const [first] = list`) — directly or behind a
  // helper's return type — carries a type with `undefined` erased. An
  // "always truthy" verdict on such a type is advice to delete a
  // load-bearing guard. We can only prove truthiness when the type system
  // tracks absence everywhere.
  if (ctx.compilerOptions.noUncheckedIndexedAccess !== true) return;
  // Declaration files describe a foreign runtime and are known to lie under
  // edge conditions (ts.Node#parent is undefined at roots, DOM properties
  // before load). A truthiness check against an ambient claim is boundary
  // validation, not a dead branch.
  if (isAmbientDeclared(expr, ctx)) return;
  // Judge by the DECLARED type, not the flow type: flow analysis carries an
  // initializer's (possibly lying) type past an honest `| undefined`
  // annotation, which would flag the very check the annotation asks for.
  const declaredType = declaredTypeOf(expr, ctx);
  if (declaredType === null) return;
  const parts = analyzableParts(declaredType);
  if (parts === null) return;
  if (!parts.every(isDefinitelyTruthyType)) return;
  ctx.report(
    expr,
    `\`${expr.getText(ctx.sourceFile)}\` is declared \`${ctx.checker.typeToString(declaredType)}\`, which is always truthy; the condition is dead`,
  );
}

/** The expression's DECLARED type via its symbol, or null when unresolvable. */
function declaredTypeOf(expr: ts.Expression, ctx: TSVisitContext): ts.Type | null {
  const symbol = ctx.semantics.symbolAtLocation(expr);
  const declaration = symbol?.valueDeclaration;
  if (symbol === undefined || declaration === undefined) return null;
  return ctx.checker.getTypeOfSymbolAtLocation(symbol, declaration);
}

/** Union members when every one is analyzable (no any/unknown/type params), else null. */
function analyzableParts(type: ts.Type): ts.Type[] | null {
  if (isUnanalyzableType(type)) return null;
  const parts = type.isUnion() ? type.types : [type];
  if (parts.some(isUnanalyzableType)) return null;
  return parts;
}

function isAmbientDeclared(expr: ts.Expression, ctx: TSVisitContext): boolean {
  const symbol = ctx.semantics.symbolAtLocation(expr);
  const declaration = symbol?.valueDeclaration ?? symbol?.declarations?.[0];
  if (declaration === undefined) return false;
  return declaration.getSourceFile().isDeclarationFile;
}

function isUnanalyzableType(type: ts.Type): boolean {
  return (type.flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown | ts.TypeFlags.Instantiable)) !== 0;
}

function isDefinitelyTruthyType(type: ts.Type): boolean {
  // Enum members carry literal flags too, but enum value sets evolve — skip.
  if (type.flags & ts.TypeFlags.EnumLike) return false;
  if (type.isStringLiteral()) return type.value.length > 0;
  if (type.isNumberLiteral()) return type.value !== 0;
  if (type.flags & ts.TypeFlags.BigIntLiteral) {
    const value = (type as ts.BigIntLiteralType).value;
    return value.base10Value !== "0";
  }
  if (type.flags & ts.TypeFlags.BooleanLiteral) {
    return ctxIntrinsicName(type) === "true";
  }
  if (type.flags & (ts.TypeFlags.ESSymbol | ts.TypeFlags.UniqueESSymbol | ts.TypeFlags.NonPrimitive)) {
    return true;
  }
  if (type.flags & ts.TypeFlags.Object) {
    // `{}` and bare anonymous shells are satisfiable by primitives ("" has
    // string's members) — only structured object types are reliably truthy.
    return (
      type.getProperties().length > 0 ||
      type.getCallSignatures().length > 0 ||
      type.getConstructSignatures().length > 0 ||
      type.getStringIndexType() !== undefined ||
      type.getNumberIndexType() !== undefined
    );
  }
  return false;
}

function ctxIntrinsicName(type: ts.Type): string | undefined {
  const name = Reflect.get(type, "intrinsicName");
  return typeof name === "string" ? name : undefined;
}

// ---------- (b) typeof ----------

const EQUALITY_OPS = new Set([
  ts.SyntaxKind.EqualsEqualsEqualsToken,
  ts.SyntaxKind.ExclamationEqualsEqualsToken,
  ts.SyntaxKind.EqualsEqualsToken,
  ts.SyntaxKind.ExclamationEqualsToken,
]);

function checkTypeofComparison(expr: ts.BinaryExpression, ctx: TSVisitContext): void {
  if (!EQUALITY_OPS.has(expr.operatorToken.kind)) return;
  let typeofExpr: ts.TypeOfExpression;
  let literal: ts.StringLiteral;
  if (ts.isTypeOfExpression(expr.left) && ts.isStringLiteral(expr.right)) {
    typeofExpr = expr.left;
    literal = expr.right;
  } else if (ts.isTypeOfExpression(expr.right) && ts.isStringLiteral(expr.left)) {
    typeofExpr = expr.right;
    literal = expr.left;
  } else {
    return;
  }

  // `typeof document === "undefined"` and friends: ambient globals exist in
  // some runtimes and not others (SSR, workers, tests). The declaration is an
  // environment claim, not a guarantee — the guard is the point.
  if (isAmbientDeclared(typeofExpr.expression, ctx)) return;

  const operandType = ctx.semantics.typeAtLocation(typeofExpr.expression);
  const parts = analyzableParts(operandType);
  if (parts === null) return;
  if (parts.some((p) => (p.flags & ts.TypeFlags.EnumLike) !== 0)) return;

  const memberSets = parts.map(possibleTypeofResults);
  if (memberSets.some((s) => s === null)) return;
  const sets = memberSets as Set<string>[];

  const canMatch = sets.some((s) => s.has(literal.text));
  const mustMatch = sets.every((s) => s.size === 1 && s.has(literal.text));
  const isNegated =
    expr.operatorToken.kind === ts.SyntaxKind.ExclamationEqualsEqualsToken ||
    expr.operatorToken.kind === ts.SyntaxKind.ExclamationEqualsToken;

  const operandText = typeofExpr.expression.getText(ctx.sourceFile);
  const typeText = ctx.checker.typeToString(operandType);
  if (!canMatch) {
    ctx.report(
      expr,
      `typeof comparison is always ${isNegated ? "true" : "false"}: \`${operandText}\` is \`${typeText}\`, and typeof never yields "${literal.text}" for that type`,
    );
  } else if (mustMatch) {
    ctx.report(
      expr,
      `typeof comparison is always ${isNegated ? "false" : "true"}: \`${operandText}\` is \`${typeText}\`, and typeof always yields "${literal.text}" for that type`,
    );
  }
}

/** The set of strings `typeof` can produce for a type, or null if undecidable. */
function possibleTypeofResults(type: ts.Type): Set<string> | null {
  if (type.flags & (ts.TypeFlags.String | ts.TypeFlags.StringLiteral)) return new Set(["string"]);
  if (type.flags & (ts.TypeFlags.Number | ts.TypeFlags.NumberLiteral)) return new Set(["number"]);
  if (type.flags & (ts.TypeFlags.BigInt | ts.TypeFlags.BigIntLiteral)) return new Set(["bigint"]);
  if (type.flags & (ts.TypeFlags.Boolean | ts.TypeFlags.BooleanLiteral)) return new Set(["boolean"]);
  if (type.flags & (ts.TypeFlags.Undefined | ts.TypeFlags.Void)) return new Set(["undefined"]);
  if (type.flags & ts.TypeFlags.Null) return new Set(["object"]);
  if (type.flags & (ts.TypeFlags.ESSymbol | ts.TypeFlags.UniqueESSymbol)) return new Set(["symbol"]);
  if (type.flags & ts.TypeFlags.Object) {
    // A callable is always "function"; a non-callable object type can still be
    // implemented by a function with matching properties, so keep "function".
    if (type.getCallSignatures().length > 0 || type.getConstructSignatures().length > 0) {
      return new Set(["function"]);
    }
    // `{}` (e.g. `unknown` narrowed by `!== undefined`) admits primitives too.
    if (
      type.getProperties().length === 0 &&
      type.getStringIndexType() === undefined &&
      type.getNumberIndexType() === undefined
    ) {
      return null;
    }
    return new Set(["object", "function"]);
  }
  if (type.flags & ts.TypeFlags.NonPrimitive) return new Set(["object", "function"]);
  return null;
}

// ---------- (c) instanceof ----------

function checkInstanceof(expr: ts.BinaryExpression, ctx: TSVisitContext): void {
  if (expr.operatorToken.kind !== ts.SyntaxKind.InstanceOfKeyword) return;

  const targetDecl = classDeclarationOf(resolveAlias(ctx.semantics.symbolAtLocation(expr.right), ctx));
  if (targetDecl === null) return;

  const leftType = ctx.semantics.typeAtLocation(expr.left);
  const parts = analyzableParts(leftType);
  if (parts === null) return;

  // Always-true only, and only via the nominal heritage chain — structural
  // matches and cross-realm objects make always-false unprovable.
  for (const part of parts) {
    const decl = classDeclarationOf(part.getSymbol());
    if (decl === null) return;
    if (!heritageReaches(decl, targetDecl, ctx, 0)) return;
  }
  ctx.report(
    expr,
    `instanceof is always true: \`${expr.left.getText(ctx.sourceFile)}\` is \`${ctx.checker.typeToString(leftType)}\`, which already extends \`${expr.right.getText(ctx.sourceFile)}\``,
  );
}

function resolveAlias(symbol: ts.Symbol | undefined, ctx: TSVisitContext): ts.Symbol | undefined {
  if (symbol === undefined) return undefined;
  if (symbol.flags & ts.SymbolFlags.Alias) return ctx.checker.getAliasedSymbol(symbol);
  return symbol;
}

function classDeclarationOf(symbol: ts.Symbol | undefined): ts.ClassLikeDeclaration | null {
  for (const decl of symbol?.declarations ?? []) {
    if (ts.isClassDeclaration(decl) || ts.isClassExpression(decl)) return decl;
  }
  return null;
}

function heritageReaches(
  decl: ts.ClassLikeDeclaration,
  target: ts.ClassLikeDeclaration,
  ctx: TSVisitContext,
  depth: number,
): boolean {
  if (decl === target) return true;
  if (depth > 50) return false;
  const extendsClause = decl.heritageClauses?.find((c) => c.token === ts.SyntaxKind.ExtendsKeyword);
  const base = extendsClause?.types[0];
  if (base === undefined) return false;
  const baseDecl = classDeclarationOf(resolveAlias(ctx.semantics.symbolAtLocation(base.expression), ctx));
  if (baseDecl === null) return false;
  return heritageReaches(baseDecl, target, ctx, depth + 1);
}

// ---------- (d) type-predicate calls ----------

function checkPredicateCall(call: ts.CallExpression, ctx: TSVisitContext): void {
  const signature = ctx.checker.getResolvedSignature(call);
  if (signature === undefined) return;
  const predicate = ctx.checker.getTypePredicateOfSignature(signature);
  if (predicate === undefined) return;
  if (predicate.kind !== ts.TypePredicateKind.Identifier) return;
  if (predicate.type === undefined) return;

  // Judge the argument by its DECLARED type, not the flow type: inside an
  // `else if` ladder or `a(x) || b(x)` chain the flow type is narrowed by the
  // preceding tests, which would mark the deliberate exhaustive listing as
  // dead. A predicate is only dead when it can't fail on the declaration.
  const arg = call.arguments[predicate.parameterIndex];
  if (arg === undefined || !ts.isIdentifier(arg)) return;
  if (isAmbientDeclared(arg, ctx)) return;
  const declaredType = declaredTypeOf(arg, ctx);
  if (declaredType === null) return;
  if (analyzableParts(declaredType) === null) return;

  if (ctx.semantics.isTypeAssignableTo(declaredType, predicate.type)) {
    ctx.report(
      call,
      `Type predicate is always true: \`${arg.text}\` is declared \`${ctx.checker.typeToString(declaredType)}\`, already assignable to \`${ctx.checker.typeToString(predicate.type)}\``,
    );
  }
}
