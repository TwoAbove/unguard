import { dirname, join, resolve } from "node:path";
import * as ts from "typescript";
import type { SemanticServices } from "../../rules/types.ts";
import { nodeId, type GraphInput } from "../graph.ts";
import type {
  ArgShape,
  CallFact,
  ExportFact,
  ImportFact,
  ImportKind,
  NodeId,
  OverloadFamilyFact,
  ReaderFact,
  ReaderKind,
  SignatureFact,
  Site,
} from "../types.ts";

export interface ReferenceFacts {
  imports: ImportFact[];
  exports: ExportFact[];
  calls: CallFact[];
  overloads: Map<NodeId, OverloadFamilyFact>;
  readers: Map<NodeId, ReaderFact[]>;
}

type SignatureNode =
  | ts.FunctionDeclaration
  | ts.MethodDeclaration
  | ts.FunctionExpression
  | ts.ArrowFunction;

const MODULE_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"] as const;
const INDEX_BASENAMES = MODULE_EXTENSIONS.map((extension) => `index${extension}`);

export function buildReferences(input: GraphInput): ReferenceFacts {
  const facts: ReferenceFacts = {
    imports: [],
    exports: [],
    calls: [],
    overloads: new Map(),
    readers: new Map(),
  };
  const projectFiles = new Set(input.sourceFiles.map((sourceFile) => sourceFile.fileName));

  for (const sourceFile of input.sourceFiles) {
    const visit = (node: ts.Node): void => {
      collectImport(node, sourceFile, input.checker, projectFiles, facts.imports);
      collectExport(node, sourceFile, facts.exports);
      if (input.semantics !== undefined && isSignatureNode(node) && node.body !== undefined) {
        collectOverloadFamily(node, input.semantics, facts.overloads);
      }
      ts.forEachChild(node, visit);
    };
    visit(sourceFile);
  }

  const semantics = input.semantics;
  if (semantics === undefined) return facts;

  for (const sourceFile of input.sourceFiles) {
    const visit = (node: ts.Node): void => {
      if (ts.isCallExpression(node) || ts.isNewExpression(node)) {
        collectCall(node, sourceFile, semantics, facts.overloads, facts.calls);
      } else if (ts.isIdentifier(node)) {
        collectReader(node, sourceFile, semantics, facts.readers);
      }
      ts.forEachChild(node, visit);
    };
    visit(sourceFile);
  }

  return facts;
}

function collectImport(
  node: ts.Node,
  sourceFile: ts.SourceFile,
  checker: ts.TypeChecker | undefined,
  projectFiles: Set<string>,
  imports: ImportFact[],
): void {
  if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
    const source = node.moduleSpecifier.text;
    const resolvedFile = resolveModuleSpecifier(node.moduleSpecifier, sourceFile.fileName, checker, projectFiles);
    const importClause = node.importClause;
    if (importClause === undefined) {
      imports.push(importFact(sourceFile, node, "side-effect", source, resolvedFile, "", ""));
      return;
    }
    if (importClause.name !== undefined) {
      imports.push(
        importFact(sourceFile, node, "default", source, resolvedFile, "default", importClause.name.text),
      );
    }
    if (importClause.namedBindings !== undefined && ts.isNamedImports(importClause.namedBindings)) {
      for (const element of importClause.namedBindings.elements) {
        imports.push(
          importFact(
            sourceFile,
            node,
            "named",
            source,
            resolvedFile,
            element.propertyName?.text ?? element.name.text,
            element.name.text,
          ),
        );
      }
    }
    if (importClause.namedBindings !== undefined && ts.isNamespaceImport(importClause.namedBindings)) {
      imports.push(
        importFact(
          sourceFile,
          node,
          "namespace",
          source,
          resolvedFile,
          "*",
          importClause.namedBindings.name.text,
        ),
      );
    }
    return;
  }

  if (
    !ts.isExportDeclaration(node) ||
    node.moduleSpecifier === undefined ||
    !ts.isStringLiteral(node.moduleSpecifier)
  ) {
    return;
  }
  const source = node.moduleSpecifier.text;
  const resolvedFile = resolveModuleSpecifier(node.moduleSpecifier, sourceFile.fileName, checker, projectFiles);
  if (node.exportClause !== undefined && ts.isNamedExports(node.exportClause)) {
    for (const element of node.exportClause.elements) {
      imports.push(
        importFact(
          sourceFile,
          node,
          "reexport-named",
          source,
          resolvedFile,
          element.propertyName?.text ?? element.name.text,
          element.name.text,
        ),
      );
    }
  } else if (node.exportClause === undefined) {
    imports.push(importFact(sourceFile, node, "reexport-star", source, resolvedFile, "*", "*"));
  }
}

function importFact(
  sourceFile: ts.SourceFile,
  node: ts.ImportDeclaration | ts.ExportDeclaration,
  kind: ImportKind,
  source: string,
  resolvedFile: string | null,
  importedName: string,
  localName: string,
): ImportFact {
  return {
    file: sourceFile.fileName,
    site: siteOf(node, sourceFile),
    kind,
    source,
    resolvedFile,
    importedName,
    localName,
  };
}

function resolveModuleSpecifier(
  specifier: ts.StringLiteral,
  importerFile: string,
  checker: ts.TypeChecker | undefined,
  projectFiles: Set<string>,
): string | null {
  if (checker !== undefined) {
    const moduleSymbol = checker.getSymbolAtLocation(specifier);
    const declaration = moduleSymbol?.valueDeclaration ?? moduleSymbol?.declarations?.[0];
    if (
      declaration !== undefined
      && ts.isSourceFile(declaration)
      && !declaration.isDeclarationFile
      && !declaration.fileName.includes("node_modules")
    ) {
      return declaration.fileName;
    }
    return null;
  }

  const source = specifier.text;
  if (!source.startsWith(".")) return null;
  const base = resolve(dirname(importerFile), source);
  for (const extension of MODULE_EXTENSIONS) {
    const candidate = base + extension;
    if (projectFiles.has(candidate)) return candidate;
  }
  if (projectFiles.has(base)) return base;
  for (const indexName of INDEX_BASENAMES) {
    const candidate = join(base, indexName);
    if (projectFiles.has(candidate)) return candidate;
  }
  return null;
}

function collectExport(node: ts.Node, sourceFile: ts.SourceFile, exports: ExportFact[]): void {
  if (ts.isVariableStatement(node)) {
    if (!hasModifier(node, ts.SyntaxKind.ExportKeyword)) return;
    for (const declaration of node.declarationList.declarations) {
      exports.push({
        decl: nodeId(declaration, sourceFile),
        file: sourceFile.fileName,
        name: declaration.name.getText(sourceFile),
        kind: "constant",
      });
    }
    return;
  }

  if (!isExportableDeclaration(node) || !hasModifier(node, ts.SyntaxKind.ExportKeyword)) return;
  exports.push({
    decl: nodeId(node, sourceFile),
    file: sourceFile.fileName,
    name: hasModifier(node, ts.SyntaxKind.DefaultKeyword) ? "default" : (node.name?.getText(sourceFile) ?? "default"),
    kind: exportKind(node),
  });
}

type ExportableDeclaration =
  | ts.FunctionDeclaration
  | ts.TypeAliasDeclaration
  | ts.InterfaceDeclaration
  | ts.ClassDeclaration
  | ts.EnumDeclaration;

function isExportableDeclaration(node: ts.Node): node is ExportableDeclaration {
  return (
    ts.isFunctionDeclaration(node) ||
    ts.isTypeAliasDeclaration(node) ||
    ts.isInterfaceDeclaration(node) ||
    ts.isClassDeclaration(node) ||
    ts.isEnumDeclaration(node)
  );
}

function exportKind(node: ExportableDeclaration): ExportFact["kind"] {
  if (ts.isFunctionDeclaration(node)) return "function";
  if (ts.isTypeAliasDeclaration(node) || ts.isInterfaceDeclaration(node)) return "type";
  if (ts.isClassDeclaration(node)) return "class";
  return "enum";
}


function hasModifier(node: ts.Node, kind: ts.SyntaxKind): boolean {
  return ts.canHaveModifiers(node) && ts.getModifiers(node)?.some((modifier) => modifier.kind === kind) === true;
}

function collectOverloadFamily(
  node: SignatureNode,
  semantics: SemanticServices,
  overloads: Map<NodeId, OverloadFamilyFact>,
): void {
  const parent = node.parent;
  const owner = (ts.isVariableDeclaration(parent) || ts.isPropertyAssignment(parent) ||
    ts.isPropertyDeclaration(parent)) && parent.initializer === node ? parent : node;
  const name = "name" in owner ? owner.name : undefined;
  const symbol = resolveSymbol(name, semantics);
  const declaration = symbol === undefined ? owner : canonicalDeclaration(symbol);
  const id = sourceDeclarationId(declaration);
  if (id === null || overloads.has(id)) return;
  const signatures = symbol?.declarations?.filter(
    (entry): entry is SignatureNode => isSignatureNode(entry) && sourceDeclarationId(entry) !== null,
  ) ?? [];
  // Assigned functions retain their binding's identity, while the signature is their initializer.
  if (owner !== node || symbol === undefined) signatures.push(node);
  overloads.set(id, {
    id,
    name: name?.getText() ?? "<anonymous>",
    signatures: signatures.map(signatureFact),
  });
}

function canonicalDeclaration(symbol: ts.Symbol | undefined): ts.Declaration | undefined {
  if (symbol === undefined) return undefined;
  return symbol.declarations?.find((declaration) => isSignatureNode(declaration) && declaration.body !== undefined)
    ?? symbol.valueDeclaration ?? symbol.declarations?.[0];
}

function isSignatureNode(node: ts.Node): node is SignatureNode {
  return (
    ts.isFunctionDeclaration(node) ||
    ts.isMethodDeclaration(node) ||
    ts.isFunctionExpression(node) ||
    ts.isArrowFunction(node)
  );
}

function signatureFact(node: SignatureNode): SignatureFact {
  const sourceFile = node.getSourceFile();
  return {
    id: nodeId(node, sourceFile),
    site: siteOf(node, sourceFile),
    hasBody: node.body !== undefined,
    typeParams: (node.typeParameters ?? []).map((parameter) => ({
      name: parameter.name.text,
      constraintText: parameter.constraint?.getText(sourceFile).replace(/\s/g, "") ?? null,
    })),
  };
}

function collectCall(
  node: ts.CallExpression | ts.NewExpression,
  sourceFile: ts.SourceFile,
  semantics: SemanticServices,
  overloads: Map<NodeId, OverloadFamilyFact>,
  calls: CallFact[],
): void {
  if (!ts.isIdentifier(node.expression) && !ts.isPropertyAccessExpression(node.expression)) return;
  const symbol = resolveSymbol(node.expression, semantics);
  const callee = sourceDeclarationId(canonicalDeclaration(symbol));

  let resolvedSignature: number | null = null;
  if (callee !== null && (symbol?.declarations?.length ?? 0) >= 2) {
    const declaration = semantics.resolvedSignature(node)?.declaration;
    if (declaration !== undefined && sourceDeclarationId(declaration) !== null) {
      const signatureId = nodeId(declaration, declaration.getSourceFile());
      const index = overloads.get(callee)?.signatures.findIndex((signature) => signature.id === signatureId) ?? -1;
      if (index >= 0) resolvedSignature = index;
    }
  }

  calls.push({
    id: nodeId(node, sourceFile),
    site: siteOf(node, sourceFile),
    callee,
    args: [...(node.arguments ?? [])].map((argument) => argumentShape(argument, sourceFile, semantics)),
    isNew: ts.isNewExpression(node),
    hasTypeArguments: node.typeArguments !== undefined,
    resolvedSignature,
  });
}

function argumentShape(
  argument: ts.Expression,
  sourceFile: ts.SourceFile,
  semantics: SemanticServices,
): ArgShape {
  if (ts.isSpreadElement(argument)) return { kind: "spread" };
  if (isValueLiteral(argument)) {
    return { kind: "literal", text: argument.getText(sourceFile) };
  }
  if (!ts.isIdentifier(argument)) return { kind: "other" };
  const symbol = resolveSymbol(argument, semantics);
  if (symbol !== undefined && semantics.checker.isUndefinedSymbol(symbol)) {
    return { kind: "literal", text: argument.getText(sourceFile) };
  }
  return { kind: "identifier", decl: sourceDeclarationId(canonicalDeclaration(symbol)) };
}

function isValueLiteral(node: ts.Expression): boolean {
  return (
    ts.isStringLiteral(node) ||
    ts.isNumericLiteral(node) ||
    (ts.isPrefixUnaryExpression(node) && node.operator === ts.SyntaxKind.MinusToken && ts.isNumericLiteral(node.operand)) ||
    ts.isNoSubstitutionTemplateLiteral(node) ||
    node.kind === ts.SyntaxKind.TrueKeyword ||
    node.kind === ts.SyntaxKind.FalseKeyword ||
    node.kind === ts.SyntaxKind.NullKeyword
  );
}

function collectReader(
  node: ts.Identifier,
  sourceFile: ts.SourceFile,
  semantics: SemanticServices,
  readers: Map<NodeId, ReaderFact[]>,
): void {
  if (isSkippedIdentifier(node)) return;
  const symbol = resolveSymbol(node, semantics);
  const declarationId = sourceDeclarationId(canonicalDeclaration(symbol));
  if (declarationId === null) return;
  const reader: ReaderFact = {
    id: nodeId(node, sourceFile),
    site: siteOf(node, sourceFile),
    kind: readerKind(node, semantics),
  };
  const entries = readers.get(declarationId);
  if (entries === undefined) readers.set(declarationId, [reader]);
  else entries.push(reader);
}

function isSkippedIdentifier(node: ts.Identifier): boolean {
  const parent = node.parent;
  if (ts.isShorthandPropertyAssignment(parent) || ts.isPropertyAccessExpression(parent) || ts.isQualifiedName(parent)) {
    return false;
  }
  if (ts.isImportSpecifier(parent)) return true;
  if (ts.isExportSpecifier(parent)) return parent.propertyName !== undefined && parent.name === node;
  return "name" in parent && parent.name === node;
}

function readerKind(node: ts.Identifier, semantics: SemanticServices): ReaderKind {
  const parent = node.parent;
  if ((ts.isCallExpression(parent) || ts.isNewExpression(parent)) && parent.expression === node) return "call";
  if (
    ts.isPropertyAccessExpression(parent) && parent.name === node &&
    (ts.isCallExpression(parent.parent) || ts.isNewExpression(parent.parent)) &&
    parent.parent.expression === parent
  ) {
    return "call";
  }
  if (
    (ts.isCallExpression(parent) || ts.isNewExpression(parent)) &&
    parent.arguments?.some((argument) => argument === node) === true
  ) {
    return "argument";
  }
  if (
    (ts.isSpreadElement(parent) || ts.isSpreadAssignment(parent)) &&
    parent.expression === node
  ) {
    return "spread";
  }
  if (isNarrowingOperand(node, semantics)) return "narrow";
  if (isInsideTypeReference(node)) return "type-reference";
  if (
    (ts.isPropertyAccessExpression(parent) || ts.isElementAccessExpression(parent)) &&
    parent.expression === node
  ) {
    return "keyed";
  }
  return "read";
}

function isNarrowingOperand(node: ts.Identifier, semantics: SemanticServices): boolean {
  const parent = node.parent;
  if (ts.isTypeOfExpression(parent) && parent.expression === node) return true;
  if (!ts.isBinaryExpression(parent) || (parent.left !== node && parent.right !== node)) return false;
  const operator = parent.operatorToken.kind;
  if (operator === ts.SyntaxKind.InstanceOfKeyword || operator === ts.SyntaxKind.InKeyword) return true;
  if (operator !== ts.SyntaxKind.EqualsEqualsEqualsToken && operator !== ts.SyntaxKind.ExclamationEqualsEqualsToken) {
    return false;
  }
  const other = parent.left === node ? parent.right : parent.left;
  if (isValueLiteral(other)) return true;
  if (!ts.isIdentifier(other)) return false;
  const symbol = resolveSymbol(other, semantics);
  return symbol !== undefined && semantics.checker.isUndefinedSymbol(symbol);
}

function isInsideTypeReference(node: ts.Identifier): boolean {
  for (let current: ts.Node | undefined = node.parent; current !== undefined; current = current.parent) {
    if (
      ts.isTypeReferenceNode(current) ||
      ts.isTypeQueryNode(current) ||
      ts.isHeritageClause(current) ||
      ts.isExpressionWithTypeArguments(current)
    ) {
      return true;
    }
    if (ts.isStatement(current) || ts.isSourceFile(current)) return false;
  }
  return false;
}

function resolveSymbol(node: ts.Node | undefined, semantics: SemanticServices): ts.Symbol | undefined {
  if (node === undefined) return undefined;
  const parent = node.parent;
  let symbol = ts.isShorthandPropertyAssignment(parent) && parent.name === node
    ? semantics.shorthandAssignmentValueSymbol(parent)
    : semantics.symbolAtLocation(node);
  if (symbol !== undefined && (symbol.flags & ts.SymbolFlags.Alias) !== 0) {
    symbol = semantics.aliasedSymbol(symbol);
  }
  return symbol;
}


function sourceDeclarationId(declaration: ts.Declaration | undefined): NodeId | null {
  if (declaration === undefined) return null;
  const sourceFile = declaration.getSourceFile();
  if (sourceFile.isDeclarationFile || /(?:^|[\\/])node_modules(?:[\\/]|$)/.test(sourceFile.fileName)) return null;
  return nodeId(declaration, sourceFile);
}

function siteOf(node: ts.Node, sourceFile: ts.SourceFile): Site {
  const start = node.getStart(sourceFile);
  const location = sourceFile.getLineAndCharacterOfPosition(start);
  return {
    file: sourceFile.fileName,
    line: location.line + 1,
    column: location.character + 1,
    start,
    end: node.getEnd(),
  };
}
