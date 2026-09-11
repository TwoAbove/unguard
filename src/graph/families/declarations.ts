import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import * as ts from "typescript";
import { asSignatureLike, isInlineParamType, type SignatureLike } from "../../typecheck/utils.ts";
import {
  analyzeFunctionBody,
  type FunctionBodyAnalysis,
  hashText,
  hashTypeShape,
  normalizeText,
  stripCommentsAndWhitespace,
} from "../../utils/hash.ts";
import { nodeId, type GraphInput } from "../graph.ts";
import type { StatementBlock } from "../statement-sequences.ts";
import type {
  ConstantFact,
  FileFact,
  FunctionFact,
  InlineParamTypeFact,
  ObjectLiteralFact,
  ObjectLiteralPropertyFact,
  ParamFact,
  Site,
  TypeFact,
} from "../types.ts";

export interface DeclarationFacts {
  functions: FunctionFact[];
  types: TypeFact[];
  constants: ConstantFact[];
  inlineParamTypes: InlineParamTypeFact[];
  files: FileFact[];
  objectLiterals: ObjectLiteralFact[];
  blocks: StatementBlock[];
}

export function buildDeclarations(input: GraphInput): DeclarationFacts {
  const facts: DeclarationFacts = {
    functions: [],
    types: [],
    constants: [],
    inlineParamTypes: [],
    files: [],
    objectLiterals: [],
    blocks: [],
  };

  for (const sourceFile of input.sourceFiles) {
    facts.files.push({
      file: sourceFile.fileName,
      hash: hashText(sourceFile.text.replace(/\s+/g, " ").trim()),
      packageRoot: findPackageRoot(sourceFile.fileName),
    });

    const visit = (node: ts.Node): void => {
      collectNode(node, sourceFile, facts);
      ts.forEachChild(node, visit);
    };
    ts.forEachChild(sourceFile, visit);
  }

  return facts;
}

function collectNode(node: ts.Node, sourceFile: ts.SourceFile, facts: DeclarationFacts): void {
  if (ts.isTypeAliasDeclaration(node) || ts.isInterfaceDeclaration(node)) {
    facts.types.push(buildTypeFact(node, sourceFile));
  }

  if (ts.isVariableStatement(node)) {
    collectVariableFacts(node, sourceFile, facts);
  }

  if (
    ts.isFunctionDeclaration(node) ||
    ts.isPropertyAssignment(node) ||
    ts.isArrowFunction(node) ||
    ts.isFunctionExpression(node) ||
    ts.isMethodDeclaration(node)
  ) {
    collectFunction(node, sourceFile, facts.functions);
  }

  if (ts.isTypeLiteralNode(node) && isInlineParamType(node)) {
    facts.inlineParamTypes.push(buildInlineParamTypeFact(node, sourceFile));
  }

  if (ts.isObjectLiteralExpression(node)) {
    facts.objectLiterals.push(buildObjectLiteralFact(node, sourceFile));
  }

  if (ts.isBlock(node)) {
    collectStatementBlock(node, sourceFile, facts.blocks);
  }
}

function collectVariableFacts(
  statement: ts.VariableStatement,
  sourceFile: ts.SourceFile,
  facts: DeclarationFacts,
): void {
  const exported = isExported(statement);
  const isConst = (statement.declarationList.flags & ts.NodeFlags.Const) !== 0;

  for (const declaration of statement.declarationList.declarations) {
    const initializer = declaration.initializer;
    if (initializer !== undefined && ts.isIdentifier(declaration.name)) {
      if (ts.isArrowFunction(initializer) || ts.isFunctionExpression(initializer)) {
        facts.functions.push(
          buildFunctionFact(
            initializer,
            declaration,
            declaration.name.text,
            sourceFile,
            { exported },
          ),
        );
      }

      if (isConst && isConstantValue(initializer)) {
        const valueText = initializer.getText(sourceFile).replace(/\s+/g, " ").trim();
        facts.constants.push({
          kind: "constant",
          id: nodeId(declaration, sourceFile),
          name: declaration.name.text,
          site: siteOf(declaration, sourceFile),
          exported,
          hash: hashText(valueText),
          valueText,
        });
      }
    }
  }
}

function collectFunction(node: ts.Node, sourceFile: ts.SourceFile, functions: FunctionFact[]): void {
  if (ts.isFunctionDeclaration(node) && node.name !== undefined && node.body !== undefined) {
    functions.push(
      buildFunctionFact(node, node, node.name.text, sourceFile, {
        exported: isExported(node) || isExportedAsDefault(node),
        exportedAsDefault: isExportedAsDefault(node),
      }),
    );
    return;
  }

  if (ts.isPropertyAssignment(node) && isIdentifierOrStringLiteral(node.name)) {
    const initializer = node.initializer;
    if (ts.isArrowFunction(initializer) || ts.isFunctionExpression(initializer)) {
      functions.push(buildFunctionFact(initializer, node, node.name.text, sourceFile));
    }
    return;
  }

  if (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) {
    const parent = node.parent;
    if (ts.isVariableDeclaration(parent) && ts.isIdentifier(parent.name)) return;
    if (ts.isPropertyAssignment(parent)) return;

    const paramNames = node.parameters.map((parameter) => parameter.name.getText(sourceFile));
    const analysis = analyzeFunctionBody(node.body, sourceFile, paramNames);
    if (analysis.bodyLength >= 64) {
      functions.push(
        buildFunctionFact(
          node,
          node,
          deriveAnonymousName(node, sourceFile),
          sourceFile,
          {},
          analysis,
        ),
      );
    }
    return;
  }

  if (ts.isMethodDeclaration(node) && node.body !== undefined && ts.isIdentifier(node.name)) {
    const parent = node.parent;
    if (!ts.isClassDeclaration(parent) || hasNonPublicModifier(node)) return;
    const className = parent.name?.text ?? "<anonymous>";
    functions.push(
      buildFunctionFact(node, node, `${className}.${node.name.text}`, sourceFile, {
        exported: isExported(parent),
        className,
      }),
    );
  }
}

interface FunctionExtras {
  exported?: boolean;
  exportedAsDefault?: boolean;
  className?: string;
}

function buildFunctionFact(
  fn: SignatureLike,
  declaration: ts.Node,
  name: string,
  sourceFile: ts.SourceFile,
  extras: FunctionExtras = {},
  suppliedAnalysis?: FunctionBodyAnalysis,
): FunctionFact {
  const body = fn.body as ts.ConciseBody;
  const params = extractParams(fn.parameters, sourceFile);
  const analysis =
    suppliedAnalysis ??
    analyzeFunctionBody(body, sourceFile, params.map((param) => param.name));

  return {
    kind: "function",
    id: nodeId(declaration, sourceFile),
    bodyOwner: nodeId(fn, sourceFile),
    name,
    site: siteOf(declaration, sourceFile),
    exported: extras.exported ?? false,
    exportedAsDefault: extras.exportedAsDefault ?? false,
    params,
    hash: analysis.hash,
    normalizedHash: analysis.normalizedHash,
    bodyLength: analysis.bodyLength,
    normalizedBodyLength: analysis.normalizedBodyLength,
    className: extras.className ?? null,
    statementCount: ts.isBlock(body) ? body.statements.length : 1,
    hasControlFlow: hasControlFlow(body),
    isAssignmentOnly: isAssignmentOnly(body),
    hasTypePredicateReturn: fn.type !== undefined && ts.isTypePredicateNode(fn.type),
    hasTypeParameters: (fn.typeParameters?.length ?? 0) > 0,
    soleCall: findSoleCall(body, sourceFile),
    isCallbackArgument: isCallbackArgument(fn),
  };
}

function extractParams(
  parameters: ts.NodeArray<ts.ParameterDeclaration>,
  sourceFile: ts.SourceFile,
): ParamFact[] {
  return parameters.map((parameter) => ({
    id: nodeId(parameter, sourceFile),
    name: parameter.name.getText(sourceFile),
    optional: parameter.questionToken !== undefined,
    hasDefault: parameter.initializer !== undefined,
    isRest: parameter.dotDotDotToken !== undefined,
    typeText: parameter.type
      ? parameter.type.getText(sourceFile).replace(/\s+/g, " ").trim()
      : null,
  }));
}

function hasControlFlow(body: ts.Node): boolean {
  let found = false;
  const visit = (node: ts.Node): void => {
    if (found) return;
    if (isBranchingStatement(node)) {
      found = true;
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(body);
  return found;
}

function isBranchingStatement(node: ts.Node): boolean {
  return (
    ts.isIfStatement(node) ||
    ts.isSwitchStatement(node) ||
    ts.isForStatement(node) ||
    ts.isForInStatement(node) ||
    ts.isForOfStatement(node) ||
    ts.isWhileStatement(node) ||
    ts.isDoStatement(node) ||
    ts.isTryStatement(node)
  );
}

function isAssignmentOnly(body: ts.ConciseBody | undefined): boolean {
  if (body === undefined || !ts.isBlock(body) || body.statements.length !== 1) return false;
  const statement = body.statements[0];
  return (
    statement !== undefined &&
    ts.isExpressionStatement(statement) &&
    ts.isBinaryExpression(statement.expression) &&
    statement.expression.operatorToken.kind === ts.SyntaxKind.EqualsToken
  );
}

function findSoleCall(body: ts.ConciseBody | undefined, sourceFile: ts.SourceFile): string | null {
  if (body === undefined) return null;
  let call: ts.CallExpression | undefined;
  if (ts.isCallExpression(body)) {
    call = body;
  } else if (ts.isBlock(body) && body.statements.length === 1) {
    const statement = body.statements[0];
    if (
      statement !== undefined &&
      ts.isReturnStatement(statement) &&
      statement.expression !== undefined &&
      ts.isCallExpression(statement.expression)
    ) {
      call = statement.expression;
    }
  }
  if (call === undefined || (call.typeArguments?.length ?? 0) > 0) return null;
  return nodeId(call, sourceFile);
}

function buildTypeFact(
  declaration: ts.TypeAliasDeclaration | ts.InterfaceDeclaration,
  sourceFile: ts.SourceFile,
): TypeFact {
  const shapeNode = ts.isTypeAliasDeclaration(declaration) ? declaration.type : declaration;
  const members = ts.isInterfaceDeclaration(declaration)
    ? declaration.members
    : ts.isTypeLiteralNode(declaration.type)
      ? declaration.type.members
      : undefined;
  const form = ts.isInterfaceDeclaration(declaration)
    ? "interface"
    : ts.isTypeLiteralNode(declaration.type)
      ? "type-literal"
      : "other";

  return {
    kind: "type",
    id: nodeId(declaration, sourceFile),
    name: declaration.name.text,
    site: siteOf(declaration, sourceFile),
    exported: isExported(declaration),
    hash: hashTypeShape(shapeNode, sourceFile),
    form,
    memberCount: members?.length ?? 0,
    propertyNames: typePropertyNames(members, sourceFile),
  };
}

function typePropertyNames(
  members: ts.NodeArray<ts.TypeElement> | undefined,
  sourceFile: ts.SourceFile,
): string[] | null {
  if (members === undefined) return null;
  const names: string[] = [];
  for (const member of members) {
    if (!ts.isPropertySignature(member)) continue;
    const name = staticPropertyName(member.name, sourceFile);
    if (name === null) return null;
    names.push(name);
  }
  return names;
}

function buildInlineParamTypeFact(
  node: ts.TypeLiteralNode,
  sourceFile: ts.SourceFile,
): InlineParamTypeFact {
  return {
    id: nodeId(node, sourceFile),
    site: siteOf(node, sourceFile),
    hash: hashTypeShape(node, sourceFile),
    typeText: node.getText(sourceFile).replace(/\s+/g, " ").trim(),
  };
}

function buildObjectLiteralFact(
  node: ts.ObjectLiteralExpression,
  sourceFile: ts.SourceFile,
): ObjectLiteralFact {
  const enclosing = findEnclosingFunction(node);
  return {
    id: nodeId(node, sourceFile),
    site: siteOf(node, sourceFile),
    propertyNames: objectPropertyNames(node, sourceFile),
    role: isReturnValue(node, enclosing) ? "return" : "other",
    enclosingFunction: enclosingFunctionFact(enclosing, sourceFile),
    properties: node.properties
      .filter(ts.isPropertyAssignment)
      .map((property) => buildObjectPropertyFact(property, sourceFile)),
  };
}

function objectPropertyNames(
  node: ts.ObjectLiteralExpression,
  sourceFile: ts.SourceFile,
): string[] | null {
  const names: string[] = [];
  for (const property of node.properties) {
    if (ts.isSpreadAssignment(property)) return null;
    if (ts.isShorthandPropertyAssignment(property)) {
      names.push(property.name.text);
      continue;
    }
    if (
      ts.isPropertyAssignment(property) ||
      ts.isMethodDeclaration(property) ||
      ts.isGetAccessorDeclaration(property) ||
      ts.isSetAccessorDeclaration(property)
    ) {
      const name = staticPropertyName(property.name, sourceFile);
      if (name === null) return null;
      names.push(name);
    }
  }
  return names;
}

function buildObjectPropertyFact(
  property: ts.PropertyAssignment,
  sourceFile: ts.SourceFile,
): ObjectLiteralPropertyFact {
  const literal = extractLiteral(property.initializer, sourceFile);
  return {
    key: isIdentifierOrStringLiteral(property.name) ? property.name.text : "",
    site: siteOf(property, sourceFile),
    literalText: literal.literalText,
    isAsConst: literal.isAsConst,
  };
}

function extractLiteral(
  node: ts.Node,
  sourceFile: ts.SourceFile,
): { literalText: string | null; isAsConst: boolean } {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return { literalText: node.text, isAsConst: false };
  }
  if (ts.isAsExpression(node) && node.type.getText(sourceFile).trim() === "const") {
    const literal = extractLiteral(node.expression, sourceFile);
    if (literal.literalText !== null) {
      return { literalText: literal.literalText, isAsConst: true };
    }
  }
  return { literalText: null, isAsConst: false };
}

function enclosingFunctionFact(
  enclosing: SignatureLike | null,
  sourceFile: ts.SourceFile,
): ObjectLiteralFact["enclosingFunction"] {
  if (enclosing === null) return null;
  return {
    id: nodeId(enclosing, sourceFile),
    name: deriveFunctionName(enclosing, sourceFile),
    site: siteOf(enclosing, sourceFile),
    isCallbackArgument: isCallbackArgument(enclosing),
  };
}

function findEnclosingFunction(node: ts.Node): SignatureLike | null {
  let current: ts.Node | undefined = node.parent;
  while (current !== undefined) {
    const fn = asSignatureLike(current);
    if (fn !== null) return fn;
    current = current.parent;
  }
  return null;
}

function isReturnValue(node: ts.ObjectLiteralExpression, enclosing: SignatureLike | null): boolean {
  if (enclosing === null) return false;
  let current: ts.Node = node;
  while (
    (ts.isParenthesizedExpression(current.parent) || ts.isAsExpression(current.parent)) &&
    current.parent.expression === current
  ) {
    current = current.parent;
  }

  const parent = current.parent;
  if (ts.isArrowFunction(parent) && parent === enclosing && parent.body === current) return true;
  if (!ts.isReturnStatement(parent) || parent.expression !== current) return false;
  return findEnclosingFunction(parent) === enclosing;
}

function deriveFunctionName(node: SignatureLike, sourceFile: ts.SourceFile): string {
  if (ts.isFunctionDeclaration(node) && node.name !== undefined) return node.name.text;
  if (ts.isMethodDeclaration(node) && ts.isIdentifier(node.name)) {
    const parent = node.parent;
    if (ts.isClassDeclaration(parent) && parent.name !== undefined) {
      return `${parent.name.text}.${node.name.text}`;
    }
    return node.name.text;
  }
  const parent = node.parent;
  if (ts.isVariableDeclaration(parent) && ts.isIdentifier(parent.name)) return parent.name.text;
  if (ts.isPropertyAssignment(parent) && ts.isIdentifier(parent.name)) return parent.name.text;
  return `<anonymous>:${siteOf(node, sourceFile).line}`;
}

function deriveAnonymousName(
  node: ts.ArrowFunction | ts.FunctionExpression,
  sourceFile: ts.SourceFile,
): string {
  const parent = node.parent;
  const line = siteOf(node, sourceFile).line;
  if (ts.isCallExpression(parent)) {
    const grandparent = parent.parent;
    if (ts.isPropertyAssignment(grandparent) && ts.isIdentifier(grandparent.name)) {
      return grandparent.name.text;
    }
    let calleeName: string | null = null;
    if (ts.isIdentifier(parent.expression)) {
      calleeName = parent.expression.text;
    } else if (ts.isPropertyAccessExpression(parent.expression)) {
      calleeName = parent.expression.getText(sourceFile);
    }
    if (calleeName !== null) {
      const argumentIndex = parent.arguments.indexOf(node);
      if (argumentIndex >= 0) {
        return parent.arguments.length === 1
          ? `${calleeName} callback`
          : `${calleeName} callback (argument ${argumentIndex + 1})`;
      }
    }
  }
  return `<anonymous>:${line}`;
}

function isCallbackArgument(node: SignatureLike): boolean {
  let current: ts.Node = node;
  while (ts.isParenthesizedExpression(current.parent)) current = current.parent;
  const parent = current.parent;
  return ts.isCallExpression(parent) && parent.arguments.some((argument) => argument === current);
}

function collectStatementBlock(
  block: ts.Block,
  sourceFile: ts.SourceFile,
  blocks: StatementBlock[],
): void {
  if (block.statements.length < 2) return;
  const statements = block.statements.flatMap((statement) => {
    const raw = statement.getText(sourceFile);
    const stripped = stripCommentsAndWhitespace(raw);
    if (stripped.length === 0) return [];
    const start = ts.getLineAndCharacterOfPosition(sourceFile, statement.getStart(sourceFile));
    return [
      {
        hash: hashText(stripped),
        line: start.line + 1,
        column: start.character + 1,
        endLine: ts.getLineAndCharacterOfPosition(sourceFile, statement.getEnd()).line + 1,
        normalizedLength: normalizeText(raw).length,
      },
    ];
  });
  if (statements.length > 0) blocks.push({ file: sourceFile.fileName, statements });
}

function isConstantValue(node: ts.Node): boolean {
  if (
    ts.isStringLiteral(node) ||
    ts.isNumericLiteral(node) ||
    ts.isNoSubstitutionTemplateLiteral(node)
  ) {
    return true;
  }
  if (ts.isPrefixUnaryExpression(node)) return isConstantValue(node.operand);
  return ts.isBinaryExpression(node) && isConstantValue(node.left) && isConstantValue(node.right);
}

function siteOf(node: ts.Node, sourceFile: ts.SourceFile): Site {
  const start = node.getStart(sourceFile);
  const position = ts.getLineAndCharacterOfPosition(sourceFile, start);
  return {
    file: sourceFile.fileName,
    line: position.line + 1,
    column: position.character + 1,
    start,
    end: node.getEnd(),
  };
}

function staticPropertyName(name: ts.PropertyName, sourceFile: ts.SourceFile): string | null {
  if (ts.isComputedPropertyName(name)) return null;
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) {
    return name.text;
  }
  return name.getText(sourceFile);
}

function isIdentifierOrStringLiteral(
  node: ts.Node,
): node is ts.Identifier | ts.StringLiteral {
  return ts.isIdentifier(node) || ts.isStringLiteral(node);
}

function hasNonPublicModifier(node: ts.Node): boolean {
  return modifiersOf(node).some(
    (modifier) =>
      modifier.kind === ts.SyntaxKind.PrivateKeyword ||
      modifier.kind === ts.SyntaxKind.ProtectedKeyword,
  );
}

function isExported(node: ts.Node): boolean {
  return modifiersOf(node).some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword);
}

function isExportedAsDefault(node: ts.Node): boolean {
  const modifiers = modifiersOf(node);
  return (
    modifiers.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword) &&
    modifiers.some((modifier) => modifier.kind === ts.SyntaxKind.DefaultKeyword)
  );
}

function modifiersOf(node: ts.Node): readonly ts.Modifier[] {
  if (!ts.canHaveModifiers(node)) return [];
  return ts.getModifiers(node) ?? [];
}

const packageRootCache = new Map<string, string>();

function findPackageRoot(filePath: string): string {
  let directory = dirname(filePath);
  const cached = packageRootCache.get(directory);
  if (cached !== undefined) return cached;

  const visited = [directory];
  while (directory !== dirname(directory)) {
    if (existsSync(join(directory, "package.json"))) {
      for (const visitedDirectory of visited) packageRootCache.set(visitedDirectory, directory);
      return directory;
    }
    directory = dirname(directory);
    visited.push(directory);
  }
  for (const visitedDirectory of visited) packageRootCache.set(visitedDirectory, directory);
  return directory;
}
