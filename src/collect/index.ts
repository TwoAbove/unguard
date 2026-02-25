import * as ts from "typescript";
import { readFileSync } from "node:fs";
import { TypeRegistry } from "./type-registry.ts";
import { FunctionRegistry, type ParamInfo } from "./function-registry.ts";
import { hashFunctionBody } from "../utils/hash.ts";

export interface CommentInfo {
  type: "Line" | "Block";
  value: string;
  start: number;
  end: number;
}

export interface ProjectIndex {
  types: TypeRegistry;
  functions: FunctionRegistry;
  callSites: CallSite[];
  imports: ImportEntry[];
  files: Map<string, { source: string; sourceFile: ts.SourceFile; comments: CommentInfo[] }>;
}

export interface CallSite {
  calleeName: string;
  file: string;
  line: number;
  argCount: number;
  node: ts.CallExpression;
  symbol?: ts.Symbol;
}

export interface ImportEntry {
  file: string;
  localName: string;
  importedName: string;
  source: string;
}

export function collectProject(program: ts.Program): ProjectIndex {
  const checker = program.getTypeChecker();
  const types = new TypeRegistry();
  const functions = new FunctionRegistry();
  const callSites: CallSite[] = [];
  const imports: ImportEntry[] = [];
  const fileMap = new Map<string, { source: string; sourceFile: ts.SourceFile; comments: CommentInfo[] }>();

  for (const sourceFile of program.getSourceFiles()) {
    const file = sourceFile.fileName;
    // Skip declaration files and node_modules
    if (sourceFile.isDeclarationFile) continue;
    if (file.includes("node_modules")) continue;

    const source = sourceFile.getFullText();
    const comments = collectAllComments(sourceFile);
    fileMap.set(file, { source, sourceFile, comments });

    function visit(node: ts.Node): void {
      collectTypes(node, file, sourceFile, types);
      collectFunctions(node, file, sourceFile, checker, functions);
      collectCallSites(node, file, sourceFile, checker, callSites);
      collectImports(node, file, imports);
      ts.forEachChild(node, visit);
    }
    ts.forEachChild(sourceFile, visit);
  }

  return { types, functions, callSites, imports, files: fileMap };
}

function isExported(node: ts.Node): boolean {
  if (!ts.canHaveModifiers(node)) return false;
  const mods = ts.getModifiers(node);
  if (mods === undefined) return false;
  return mods.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
}

function collectTypes(node: ts.Node, file: string, sourceFile: ts.SourceFile, registry: TypeRegistry): void {
  if (ts.isTypeAliasDeclaration(node)) {
    const line = ts.getLineAndCharacterOfPosition(sourceFile, node.getStart(sourceFile)).line + 1;
    registry.add(node.name.text, file, line, node.type, sourceFile, isExported(node));
  }
  if (ts.isInterfaceDeclaration(node)) {
    const line = ts.getLineAndCharacterOfPosition(sourceFile, node.getStart(sourceFile)).line + 1;
    registry.add(node.name.text, file, line, node, sourceFile, isExported(node));
  }
}

function collectFunctions(node: ts.Node, file: string, sourceFile: ts.SourceFile, checker: ts.TypeChecker, registry: FunctionRegistry): void {
  if (ts.isFunctionDeclaration(node) && node.name && node.body) {
    const line = ts.getLineAndCharacterOfPosition(sourceFile, node.getStart(sourceFile)).line + 1;
    const params = extractParams(node.parameters, sourceFile);
    const hash = hashFunctionBody(node.body, sourceFile);
    const symbol = checker.getSymbolAtLocation(node.name);
    registry.add({ name: node.name.text, file, line, hash, params, node, exported: isExported(node), symbol });
  }

  // Arrow functions assigned to const: const foo = (...) => { ... }
  if (ts.isVariableStatement(node)) {
    const exported = isExported(node);
    for (const decl of node.declarationList.declarations) {
      if (decl.initializer && ts.isArrowFunction(decl.initializer) && ts.isIdentifier(decl.name)) {
        const arrow = decl.initializer;
        const body = ts.isBlock(arrow.body) ? arrow.body : arrow.body;
        const line = ts.getLineAndCharacterOfPosition(sourceFile, decl.getStart(sourceFile)).line + 1;
        const params = extractParams(arrow.parameters, sourceFile);
        const hash = hashFunctionBody(body, sourceFile);
        const symbol = checker.getSymbolAtLocation(decl.name);
        registry.add({ name: decl.name.text, file, line, hash, params, node: arrow, exported, symbol });
      }
    }
  }
}

function extractParams(parameters: ts.NodeArray<ts.ParameterDeclaration>, sourceFile: ts.SourceFile): ParamInfo[] {
  return parameters.map((p) => {
    const name = p.name.getText(sourceFile);
    const optional = p.questionToken !== undefined;
    const hasDefault = p.initializer !== undefined;
    const typeText = p.type ? p.type.getText(sourceFile) : null;
    return { name, optional, hasDefault, typeText };
  });
}

function collectImports(node: ts.Node, file: string, imports: ImportEntry[]): void {
  if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
    const moduleSource = node.moduleSpecifier.text;
    const clause = node.importClause;
    if (!clause) return;

    // Default import
    if (clause.name) {
      imports.push({
        file,
        localName: clause.name.text,
        importedName: "default",
        source: moduleSource,
      });
    }

    // Named imports
    if (clause.namedBindings && ts.isNamedImports(clause.namedBindings)) {
      for (const el of clause.namedBindings.elements) {
        imports.push({
          file,
          localName: el.name.text,
          importedName: el.propertyName ? el.propertyName.text : el.name.text,
          source: moduleSource,
        });
      }
    }
  }

  // Re-exports: export { x } from "./mod"
  if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
    const moduleSource = node.moduleSpecifier.text;
    if (node.exportClause && ts.isNamedExports(node.exportClause)) {
      for (const el of node.exportClause.elements) {
        imports.push({
          file,
          localName: el.name.text,
          importedName: el.propertyName ? el.propertyName.text : el.name.text,
          source: moduleSource,
        });
      }
    }
  }
}

function collectCallSites(node: ts.Node, file: string, sourceFile: ts.SourceFile, checker: ts.TypeChecker, sites: CallSite[]): void {
  if (!ts.isCallExpression(node)) return;
  let calleeName: string | null = null;
  if (ts.isIdentifier(node.expression)) {
    calleeName = node.expression.text;
  } else if (ts.isPropertyAccessExpression(node.expression)) {
    calleeName = node.expression.name.text;
  }
  if (calleeName) {
    const line = ts.getLineAndCharacterOfPosition(sourceFile, node.getStart(sourceFile)).line + 1;
    // Resolve the symbol the call refers to (follows imports to the declaration)
    let symbol: ts.Symbol | undefined;
    try {
      symbol = checker.getSymbolAtLocation(node.expression);
      if (symbol && (symbol.flags & ts.SymbolFlags.Alias)) {
        symbol = checker.getAliasedSymbol(symbol);
      }
    } catch {
      // Symbol resolution can fail on synthetic nodes
    }
    sites.push({
      calleeName,
      file,
      line,
      argCount: node.arguments.length,
      node,
      symbol,
    });
  }
}

/** Collect all comments from a source file. */
export function collectAllComments(sourceFile: ts.SourceFile): CommentInfo[] {
  const comments: CommentInfo[] = [];
  const source = sourceFile.getFullText();
  const seen = new Set<number>();

  function visit(node: ts.Node): void {
    const leading = ts.getLeadingCommentRanges(source, node.getFullStart());
    if (leading) {
      for (const r of leading) {
        if (seen.has(r.pos)) continue;
        seen.add(r.pos);
        const isLine = r.kind === ts.SyntaxKind.SingleLineCommentTrivia;
        comments.push({
          type: isLine ? "Line" : "Block",
          value: source.slice(r.pos + 2, isLine ? r.end : r.end - 2),
          start: r.pos,
          end: r.end,
        });
      }
    }
    const trailing = ts.getTrailingCommentRanges(source, node.getEnd());
    if (trailing) {
      for (const r of trailing) {
        if (seen.has(r.pos)) continue;
        seen.add(r.pos);
        const isLine = r.kind === ts.SyntaxKind.SingleLineCommentTrivia;
        comments.push({
          type: isLine ? "Line" : "Block",
          value: source.slice(r.pos + 2, isLine ? r.end : r.end - 2),
          start: r.pos,
          end: r.end,
        });
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);

  return comments;
}
