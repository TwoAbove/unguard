import * as ts from "typescript";
import type { TSRule, TSVisitContext } from "../types.ts";

const arrayMutators = new Set([
  "copyWithin",
  "fill",
  "pop",
  "push",
  "reverse",
  "shift",
  "sort",
  "splice",
  "unshift",
]);

const mapMutators = new Set(["clear", "delete", "set"]);
const setMutators = new Set(["add", "clear", "delete"]);

export const noModuleStateWrite: TSRule = {
  kind: "ts",
  id: "no-module-state-write",
  severity: "warning",
  message: "Function mutates module-scope state; make the dependency explicit instead of writing ambient state",

  visit(node: ts.Node, ctx: TSVisitContext) {
    if (getEnclosingFunctionLike(node) === null) return;

    const bindingName = getAmbientWriteBinding(node, ctx);
    if (!bindingName) return;

    ctx.report(node, `Function mutates module-scope state through "${bindingName}"`);
  },
};

function getAmbientWriteBinding(node: ts.Node, ctx: TSVisitContext): string | null {
  if (ts.isBinaryExpression(node) && isAssignmentOperator(node.operatorToken.kind)) {
    return getAmbientBindingFromWriteTarget(node.left, ctx);
  }

  if (ts.isPrefixUnaryExpression(node)) {
    if (node.operator === ts.SyntaxKind.PlusPlusToken || node.operator === ts.SyntaxKind.MinusMinusToken) {
      return getAmbientBindingFromWriteTarget(node.operand, ctx);
    }
  }

  if (ts.isPostfixUnaryExpression(node)) {
    if (node.operator === ts.SyntaxKind.PlusPlusToken || node.operator === ts.SyntaxKind.MinusMinusToken) {
      return getAmbientBindingFromWriteTarget(node.operand, ctx);
    }
  }

  if (ts.isDeleteExpression(node)) {
    return getAmbientBindingFromWriteTarget(node.expression, ctx);
  }

  if (ts.isCallExpression(node)) {
    return getAmbientBindingFromMutatorCall(node, ctx);
  }

  return null;
}

function getAmbientBindingFromWriteTarget(node: ts.Expression, ctx: TSVisitContext): string | null {
  const target = unwrapExpression(node);

  if (ts.isIdentifier(target)) {
    return isAmbientBinding(target, ctx) ? target.text : null;
  }

  if (ts.isPropertyAccessExpression(target) || ts.isElementAccessExpression(target)) {
    const root = getRootIdentifier(target.expression);
    if (!root) return null;
    return isAmbientBinding(root, ctx) ? root.text : null;
  }

  return null;
}

function getAmbientBindingFromMutatorCall(node: ts.CallExpression, ctx: TSVisitContext): string | null {
  const callee = unwrapExpression(node.expression);
  if (!ts.isPropertyAccessExpression(callee)) return null;

  const receiver = unwrapExpression(callee.expression);
  const root = getRootIdentifier(receiver);
  if (!root || !isAmbientBinding(root, ctx)) return null;

  const receiverType = ctx.checker.getTypeAtLocation(receiver);
  const method = callee.name.text;
  if (!isKnownMutator(receiverType, method, ctx.checker)) return null;

  return root.text;
}

function isAmbientBinding(node: ts.Identifier, ctx: TSVisitContext): boolean {
  const symbol = ctx.checker.getSymbolAtLocation(node);
  if (!symbol) return false;

  for (const declaration of symbol.declarations ?? []) {
    if (!isAmbientBindingDeclaration(declaration, ctx.sourceFile)) continue;
    return true;
  }

  return false;
}

function isAmbientBindingDeclaration(node: ts.Declaration, sourceFile: ts.SourceFile): boolean {
  if (node.getSourceFile() !== sourceFile) return false;
  if (getEnclosingFunctionLike(node) !== null) return false;

  return (
    ts.isVariableDeclaration(node) ||
    ts.isBindingElement(node) ||
    ts.isImportClause(node) ||
    ts.isImportSpecifier(node) ||
    ts.isNamespaceImport(node) ||
    ts.isImportEqualsDeclaration(node)
  );
}

function getRootIdentifier(node: ts.Expression): ts.Identifier | null {
  const target = unwrapExpression(node);

  if (ts.isIdentifier(target)) return target;
  if (ts.isPropertyAccessExpression(target) || ts.isElementAccessExpression(target)) {
    return getRootIdentifier(target.expression);
  }

  return null;
}

function unwrapExpression(node: ts.Expression): ts.Expression {
  let current = node;

  while (true) {
    if (ts.isParenthesizedExpression(current)) {
      current = current.expression;
      continue;
    }
    if (ts.isAsExpression(current) || ts.isTypeAssertionExpression(current) || ts.isNonNullExpression(current)) {
      current = current.expression;
      continue;
    }
    if (ts.isSatisfiesExpression(current)) {
      current = current.expression;
      continue;
    }
    return current;
  }
}

function isAssignmentOperator(kind: ts.SyntaxKind): boolean {
  switch (kind) {
    case ts.SyntaxKind.EqualsToken:
    case ts.SyntaxKind.PlusEqualsToken:
    case ts.SyntaxKind.MinusEqualsToken:
    case ts.SyntaxKind.AsteriskEqualsToken:
    case ts.SyntaxKind.AsteriskAsteriskEqualsToken:
    case ts.SyntaxKind.SlashEqualsToken:
    case ts.SyntaxKind.PercentEqualsToken:
    case ts.SyntaxKind.AmpersandEqualsToken:
    case ts.SyntaxKind.BarEqualsToken:
    case ts.SyntaxKind.CaretEqualsToken:
    case ts.SyntaxKind.LessThanLessThanEqualsToken:
    case ts.SyntaxKind.GreaterThanGreaterThanEqualsToken:
    case ts.SyntaxKind.GreaterThanGreaterThanGreaterThanEqualsToken:
    case ts.SyntaxKind.BarBarEqualsToken:
    case ts.SyntaxKind.AmpersandAmpersandEqualsToken:
    case ts.SyntaxKind.QuestionQuestionEqualsToken:
      return true;
    default:
      return false;
  }
}

function getEnclosingFunctionLike(node: ts.Node): ts.SignatureDeclaration | null {
  let current: ts.Node | undefined = node.parent;
  while (current) {
    if (ts.isFunctionLike(current)) return current;
    current = current.parent;
  }
  return null;
}

function isKnownMutator(type: ts.Type, method: string, checker: ts.TypeChecker): boolean {
  const apparent = checker.getApparentType(type);

  if (checker.isArrayType(apparent) || checker.isTupleType(apparent)) {
    return arrayMutators.has(method);
  }

  const symbol = apparent.getSymbol();
  const name = symbol?.getName();
  if (name === "Map" || name === "WeakMap") {
    return mapMutators.has(method);
  }
  if (name === "Set" || name === "WeakSet") {
    return setMutators.has(method);
  }

  return false;
}
