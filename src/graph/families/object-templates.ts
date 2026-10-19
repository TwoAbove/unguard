import * as ts from "typescript";
import { nodeId } from "../graph.ts";
import type { ObjectLiteralFact, ObjectLiteralTemplateFact } from "../types.ts";

/** This separate family leaves source-only declaration queries checker-free. */
export function buildObjectLiteralTemplates(
  sourceFiles: readonly ts.SourceFile[],
  checker: ts.TypeChecker,
  literals: readonly ObjectLiteralFact[],
): ObjectLiteralTemplateFact[] {
  const facts = new Map(literals.map((fact) => [fact.id, fact]));
  const result: ObjectLiteralTemplateFact[] = [];
  for (const sourceFile of sourceFiles) {
    const visit = (node: ts.Node): void => {
      if (ts.isObjectLiteralExpression(node)) {
        const template = buildTemplate(node, sourceFile, checker);
        const fact = facts.get(nodeId(node, sourceFile));
        if (template !== null && fact !== undefined) result.push({ ...fact, template });
      }
      ts.forEachChild(node, visit);
    };
    ts.forEachChild(sourceFile, visit);
  }
  return result;
}

function buildTemplate(
  root: ts.ObjectLiteralExpression,
  sourceFile: ts.SourceFile,
  checker: ts.TypeChecker,
): ObjectLiteralTemplateFact["template"] | null {
  const functionBodies = new Set<ts.Node>();
  for (const property of root.properties) {
    if (ts.isMethodDeclaration(property) || ts.isGetAccessorDeclaration(property) || ts.isSetAccessorDeclaration(property)) {
      if (property.body !== undefined) functionBodies.add(property.body);
    } else if (ts.isPropertyAssignment(property)) {
      let initializer = property.initializer;
      while (isTransparentExpression(initializer)) initializer = initializer.expression;
      if (ts.isArrowFunction(initializer) || ts.isFunctionExpression(initializer)) {
        functionBodies.add(initializer.body);
      }
    }
  }
  const bound = new Map<ts.Symbol, number>();
  const free = new Map<ts.Symbol, number>();
  const freeDeclarations: string[] = [];
  const literals: string[] = [];
  const parts: string[] = [];
  let size = 0;
  let accessCallCount = 0;
  let resolved = true;
  let functionBodySize = 0;
  let inBody = false;

  const reference = (node: ts.Identifier): void => {
    const parent = node.parent;
    if (ts.isTypeReferenceNode(parent) && parent.typeName === node && node.text === "const" &&
      parent.typeArguments === undefined &&
      (ts.isAsExpression(parent.parent) || ts.isTypeAssertionExpression(parent.parent)) &&
      parent.parent.type === parent) {
      parts.push("const-assertion");
      return;
    }
    let symbol = ts.isShorthandPropertyAssignment(parent) && parent.name === node
      ? checker.getShorthandAssignmentValueSymbol(parent)
      : checker.getSymbolAtLocation(node);
    if (symbol === undefined) {
      resolved = false;
      return;
    }
    if ((symbol.flags & ts.SymbolFlags.Alias) !== 0) symbol = checker.getAliasedSymbol(symbol);
    const declarations = symbol.declarations;
    if (declarations === undefined || declarations.length === 0) {
      if ((checker.getTypeAtLocation(node).flags & ts.TypeFlags.Undefined) !== 0) {
        parts.push("intrinsic:undefined");
        return;
      }
      resolved = false;
      return;
    }
    const firstDeclaration = declarations[0];
    if (firstDeclaration === undefined) {
      resolved = false;
      return;
    }
    const local = declarations.every((declaration) =>
      declaration.getSourceFile() === sourceFile && declaration.pos >= root.pos && declaration.end <= root.end
    );
    const indices = local ? bound : free;
    let index = indices.get(symbol);
    if (index === undefined) {
      index = indices.size;
      indices.set(symbol, index);
      if (!local) {
        // Declaration order can differ between programs; select a canonical site.
        let identity = nodeId(firstDeclaration, firstDeclaration.getSourceFile());
        for (const declaration of declarations) {
          const candidate = nodeId(declaration, declaration.getSourceFile());
          if (candidate < identity) identity = candidate;
        }
        freeDeclarations.push(identity);
      }
    }
    parts.push(`${local ? "bound" : "free"}:${index}`);
  };

  const visit = (node: ts.Node): void => {
    size++;
    if (ts.isPropertyAccessExpression(node) || ts.isCallExpression(node)) accessCallCount++;
    const previousInBody = inBody;
    inBody = inBody || functionBodies.has(node);
    if (inBody) functionBodySize++;
    const boolean = node.kind === ts.SyntaxKind.TrueKeyword || node.kind === ts.SyntaxKind.FalseKeyword;
    parts.push(`(${boolean ? "boolean" : node.kind}`);
    if (ts.isPrefixUnaryExpression(node) || ts.isPostfixUnaryExpression(node) || ts.isTypeOperatorNode(node)) {
      parts.push(`operator:${node.operator}`);
    } else if (ts.isMetaProperty(node)) {
      parts.push(`keyword:${node.keywordToken}`);
    } else if (ts.isHeritageClause(node) || ts.isImportAttributes(node)) {
      parts.push(`token:${node.token}`);
    } else if (ts.isImportTypeNode(node)) {
      parts.push(`typeof:${node.isTypeOf}`);
    }
    if (isPropertyKey(node)) {
      parts.push(JSON.stringify(node.getText(sourceFile)));
      if (ts.isIdentifier(node) && isShorthandKey(node)) reference(node);
    } else if (ts.isIdentifier(node)) {
      reference(node);
    } else if (ts.isLiteralExpression(node) || ts.isTemplateLiteralToken(node) || ts.isTemplateExpression(node) || boolean) {
      literals.push(node.getText(sourceFile));
      parts.push("hole");
    } else if (ts.isVariableDeclarationList(node)) {
      parts.push(`flags:${node.flags & ts.NodeFlags.BlockScoped}`);
    }
    if (!ts.isTemplateExpression(node)) ts.forEachChild(node, visit);
    parts.push(")");
    inBody = previousInBody;
  };
  visit(root);
  if (!resolved) return null;
  return {
    fingerprint: parts.join(" "),
    size,
    functionMembers: functionBodies.size,
    functionBodySize,
    accessCallCount,
    freeDeclarations,
    literals,
  };
}

function isShorthandKey(node: ts.Identifier): boolean {
  const parent = node.parent;
  return (ts.isShorthandPropertyAssignment(parent) && parent.name === node) ||
    (ts.isBindingElement(parent) && parent.propertyName === undefined && parent.name === node &&
      ts.isObjectBindingPattern(parent.parent));
}

function isPropertyKey(node: ts.Node): boolean {
  let keyExpression = node;
  let parent = node.parent;
  if (ts.isStringLiteralLike(node) || ts.isNumericLiteral(node)) {
    while (isTransparentExpression(parent) && parent.expression === keyExpression) {
      keyExpression = parent;
      parent = parent.parent;
    }
  }
  if (ts.isComputedPropertyName(node)) return false;
  if (ts.isComputedPropertyName(parent) ||
    (ts.isElementAccessExpression(parent) && parent.argumentExpression === keyExpression)) {
    return ts.isStringLiteralLike(node) || ts.isNumericLiteral(node);
  }
  if (ts.isMetaProperty(parent)) return parent.name === node;
  if (ts.isPropertyAccessExpression(parent)) return parent.name === node;
  if (ts.isQualifiedName(parent)) return parent.right === node;
  if (ts.isBindingElement(parent)) {
    return parent.propertyName === node || (ts.isIdentifier(node) && isShorthandKey(node));
  }
  return (ts.isPropertyAssignment(parent) || ts.isShorthandPropertyAssignment(parent) ||
    ts.isPropertyDeclaration(parent) || ts.isPropertySignature(parent) ||
    ts.isMethodDeclaration(parent) || ts.isMethodSignature(parent) ||
    ts.isGetAccessorDeclaration(parent) || ts.isSetAccessorDeclaration(parent) || ts.isEnumMember(parent)) &&
    parent.name === node;
}

function isTransparentExpression(node: ts.Node): node is
  | ts.ParenthesizedExpression
  | ts.AsExpression
  | ts.SatisfiesExpression
  | ts.NonNullExpression
  | ts.TypeAssertion {
  return ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isSatisfiesExpression(node) ||
    ts.isNonNullExpression(node) || ts.isTypeAssertionExpression(node);
}

