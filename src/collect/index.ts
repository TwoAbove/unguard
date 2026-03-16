import * as ts from "typescript";
import { createHash } from "node:crypto";
import { TypeRegistry } from "./type-registry.ts";
import { FunctionRegistry, type FunctionEntry, type ParamInfo } from "./function-registry.ts";
import { ConstantRegistry } from "./constant-registry.ts";
import { hashFunctionBody, hashFunctionBodyNormalized, bodyTextLength, normalizedBodyTextLength, normalizeText, hashText } from "../utils/hash.ts";
import { StatementSequenceRegistry, type StatementSequenceEntry } from "./statement-sequence-registry.ts";
import { InlineParamTypeRegistry } from "./inline-type-registry.ts";
import type { Diagnostic, TSRule } from "../rules/types.ts";
import { buildContext } from "../typecheck/walk.ts";
import { isInlineParamType } from "../typecheck/utils.ts";

export interface CommentInfo {
  type: "Line" | "Block";
  value: string;
  start: number;
  end: number;
}

export interface ProjectIndex {
  types: TypeRegistry;
  functions: FunctionRegistry;
  constants: ConstantRegistry;
  callSites: CallSite[];
  imports: ImportEntry[];
  files: Map<string, { source: string; sourceFile: ts.SourceFile; comments: CommentInfo[] }>;
  /** Whitespace-normalized file content hash → list of file paths */
  fileHashes: Map<string, string[]>;
  statementSequences: StatementSequenceRegistry;
  inlineParamTypes: InlineParamTypeRegistry;
}

export interface CallSite {
  calleeName: string;
  file: string;
  line: number;
  argCount: number;
  node: ts.CallExpression;
  symbol?: ts.Symbol;
  resolvedDeclaration?: ts.SignatureDeclaration | ts.JSDocSignature;
}

export interface ImportEntry {
  file: string;
  localName: string;
  importedName: string;
  source: string;
}

export function collectProject(
  program: ts.Program,
  tsRules?: TSRule[],
  allowedFiles?: Set<string>,
): { index: ProjectIndex; diagnostics: Diagnostic[] } {
  const checker = program.getTypeChecker();
  const types = new TypeRegistry();
  const functions = new FunctionRegistry();
  const constants = new ConstantRegistry();
  const callSites: CallSite[] = [];
  const imports: ImportEntry[] = [];
  const statementSequences = new StatementSequenceRegistry();
  const inlineParamTypes = new InlineParamTypeRegistry();
  const fileMap = new Map<string, { source: string; sourceFile: ts.SourceFile; comments: CommentInfo[] }>();
  const diagnostics: Diagnostic[] = [];

  for (const sourceFile of program.getSourceFiles()) {
    const file = sourceFile.fileName;
    if (sourceFile.isDeclarationFile) continue;
    if (file.includes("node_modules")) continue;

    const isReportable = !allowedFiles || allowedFiles.has(file);
    const source = sourceFile.getFullText();

    // Always collect cross-file data (types, functions, call sites, imports)
    // from all program files for complete analysis context.
    // Only run TS rules and include in fileMap for reportable (scanned) files.
    if (isReportable) {
      const comments = collectAllComments(sourceFile);
      fileMap.set(file, { source, sourceFile, comments });
    }

    const ruleContexts = isReportable
      ? tsRules?.map((rule) => ({
          rule,
          ctx: buildContext(rule, sourceFile, checker, source, file, diagnostics),
        }))
      : undefined;

    function visit(node: ts.Node): void {
      collectTypes(node, file, sourceFile, types);
      collectFunctions(node, file, sourceFile, checker, functions);
      collectConstants(node, file, sourceFile, constants);
      collectCallSites(node, file, sourceFile, checker, callSites);
      collectStatementSequences(node, file, sourceFile, statementSequences);
      collectInlineParamTypes(node, file, sourceFile, inlineParamTypes);
      collectImports(node, file, imports);
      if (ruleContexts) {
        for (const { rule, ctx } of ruleContexts) {
          rule.visit(node, ctx);
        }
      }
      ts.forEachChild(node, visit);
    }
    ts.forEachChild(sourceFile, visit);
  }

  // Compute whole-file content hashes for duplicate-file detection
  const fileHashes = new Map<string, string[]>();
  for (const [file, { source }] of fileMap) {
    const normalized = source.replace(/\s+/g, " ").trim();
    const hash = createHash("sha256").update(normalized).digest("hex").slice(0, 16);
    let list = fileHashes.get(hash);
    if (list === undefined) {
      list = [];
      fileHashes.set(hash, list);
    }
    list.push(file);
  }

  return { index: { types, functions, constants, callSites, imports, files: fileMap, fileHashes, statementSequences, inlineParamTypes }, diagnostics };
}

function hasNonPublicModifier(node: ts.Node): boolean {
  if (!ts.canHaveModifiers(node)) return false;
  const mods = ts.getModifiers(node);
  if (mods === undefined) return false;
  return mods.some(
    (m) => m.kind === ts.SyntaxKind.PrivateKeyword || m.kind === ts.SyntaxKind.ProtectedKeyword,
  );
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

function isConstantValue(node: ts.Node): boolean {
  if (ts.isStringLiteral(node)) return true;
  if (ts.isNumericLiteral(node)) return true;
  if (ts.isNoSubstitutionTemplateLiteral(node)) return true;
  if (ts.isPrefixUnaryExpression(node)) return isConstantValue(node.operand);
  if (ts.isBinaryExpression(node)) return isConstantValue(node.left) && isConstantValue(node.right);
  return false;
}

function collectConstants(node: ts.Node, file: string, sourceFile: ts.SourceFile, registry: ConstantRegistry): void {
  if (!ts.isVariableStatement(node)) return;
  if (!(node.declarationList.flags & ts.NodeFlags.Const)) return;
  const exported = isExported(node);
  for (const decl of node.declarationList.declarations) {
    if (!decl.initializer || !ts.isIdentifier(decl.name)) continue;
    if (!isConstantValue(decl.initializer)) continue;
    const valueText = decl.initializer.getText(sourceFile).replace(/\s+/g, " ").trim();
    const valueHash = createHash("sha256").update(valueText).digest("hex").slice(0, 16);
    const line = ts.getLineAndCharacterOfPosition(sourceFile, decl.getStart(sourceFile)).line + 1;
    registry.add({ name: decl.name.text, file, line, valueHash, valueText, exported });
  }
}

function buildFunctionEntry(
  body: ts.Node,
  parameters: ts.NodeArray<ts.ParameterDeclaration>,
  sourceFile: ts.SourceFile,
  file: string,
  lineNode: ts.Node,
  name: string,
  extra: Partial<Pick<FunctionEntry, "exported" | "symbol" | "className" | "implementsInterface" | "node">>,
): FunctionEntry {
  const line = ts.getLineAndCharacterOfPosition(sourceFile, lineNode.getStart(sourceFile)).line + 1;
  const params = extractParams(parameters, sourceFile);
  const paramNames = params.map((p) => p.name);
  const hash = hashFunctionBody(body, sourceFile);
  const normalizedHash = hashFunctionBodyNormalized(body, sourceFile, paramNames);
  const bodyLength = bodyTextLength(body, sourceFile);
  const normalizedBodyLength = normalizedBodyTextLength(body, sourceFile, paramNames);
  return {
    name,
    file,
    line,
    hash,
    normalizedHash,
    params,
    node: extra.node ?? body,
    exported: extra.exported ?? false,
    bodyLength,
    normalizedBodyLength,
    ...extra,
  };
}

function collectFunctions(node: ts.Node, file: string, sourceFile: ts.SourceFile, checker: ts.TypeChecker, registry: FunctionRegistry): void {
  if (ts.isFunctionDeclaration(node) && node.name && node.body) {
    registry.add(buildFunctionEntry(node.body, node.parameters, sourceFile, file, node, node.name.text, {
      exported: isExported(node), symbol: checker.getSymbolAtLocation(node.name), node,
    }));
  }

  // Arrow functions and function expressions assigned to const: const foo = (...) => { ... } / const foo = function() { ... }
  if (ts.isVariableStatement(node)) {
    const exported = isExported(node);
    for (const decl of node.declarationList.declarations) {
      if (decl.initializer && ts.isArrowFunction(decl.initializer) && ts.isIdentifier(decl.name)) {
        const arrow = decl.initializer;
        registry.add(buildFunctionEntry(arrow.body, arrow.parameters, sourceFile, file, decl, decl.name.text, {
          exported, symbol: checker.getSymbolAtLocation(decl.name), node: arrow,
        }));
      }
      if (decl.initializer && ts.isFunctionExpression(decl.initializer) && ts.isIdentifier(decl.name)) {
        const fn = decl.initializer;
        if (fn.body) {
          registry.add(buildFunctionEntry(fn.body, fn.parameters, sourceFile, file, decl, decl.name.text, {
            exported, symbol: checker.getSymbolAtLocation(decl.name), node: fn,
          }));
        }
      }
    }
  }

  // Object property functions: { key: (...) => { ... } } or { key: function(...) { ... } }
  if (ts.isPropertyAssignment(node) && (ts.isIdentifier(node.name) || ts.isStringLiteral(node.name))) {
    const init = node.initializer;
    const propName = node.name.text;
    if (ts.isArrowFunction(init)) {
      registry.add(buildFunctionEntry(init.body, init.parameters, sourceFile, file, node, propName, { node: init }));
    }
    if (ts.isFunctionExpression(init) && init.body) {
      registry.add(buildFunctionEntry(init.body, init.parameters, sourceFile, file, node, propName, { node: init }));
    }
  }

  // Anonymous/nested functions (catch-all for ArrowFunction/FunctionExpression not already collected)
  if (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) {
    const parent = node.parent;
    // Skip if already collected by VariableStatement path
    if (ts.isVariableDeclaration(parent) && ts.isIdentifier(parent.name)) {
      // Already collected above
    }
    // Skip if already collected by PropertyAssignment path
    else if (ts.isPropertyAssignment(parent)) {
      // Already collected above
    }
    else {
      const body = ts.isArrowFunction(node) ? node.body : (node as ts.FunctionExpression).body;
      if (body) {
        const MIN_ANON_BODY = 64;
        if (bodyTextLength(body, sourceFile) >= MIN_ANON_BODY) {
          const name = deriveAnonymousName(node, sourceFile);
          registry.add(buildFunctionEntry(body, node.parameters, sourceFile, file, node, name, { node }));
        }
      }
    }
  }

  // Class methods
  if (ts.isMethodDeclaration(node) && node.body && ts.isIdentifier(node.name)) {
    const parent = node.parent;
    if (ts.isClassDeclaration(parent)) {
      if (hasNonPublicModifier(node)) return;
      const className = parent.name ? parent.name.text : "<anonymous>";
      const name = `${className}.${node.name.text}`;
      const implementsInterface = parent.heritageClauses?.some(
        (c) => c.token === ts.SyntaxKind.ImplementsKeyword,
      ) ?? false;
      registry.add(buildFunctionEntry(node.body, node.parameters, sourceFile, file, node, name, {
        exported: isExported(parent), symbol: checker.getSymbolAtLocation(node.name), node, className, implementsInterface,
      }));
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

function deriveAnonymousName(node: ts.ArrowFunction | ts.FunctionExpression, sourceFile: ts.SourceFile): string {
  const parent = node.parent;
  const line = ts.getLineAndCharacterOfPosition(sourceFile, node.getStart(sourceFile)).line + 1;

  // Parent is CallExpression — check if grandparent is a PropertyAssignment with a name
  if (ts.isCallExpression(parent)) {
    const grandparent = parent.parent;
    if (ts.isPropertyAssignment(grandparent) && ts.isIdentifier(grandparent.name)) {
      return grandparent.name.text;
    }
    // Callee name + arg index
    let calleeName: string | null = null;
    if (ts.isIdentifier(parent.expression)) {
      calleeName = parent.expression.text;
    } else if (ts.isPropertyAccessExpression(parent.expression)) {
      calleeName = parent.expression.name.text;
    }
    if (calleeName) {
      const argIndex = parent.arguments.indexOf(node as ts.Expression);
      if (argIndex >= 0) return `${calleeName}.$arg${argIndex}`;
    }
  }

  return `<anonymous>:${line}`;
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

function collectStatementSequences(
  node: ts.Node,
  file: string,
  sourceFile: ts.SourceFile,
  registry: StatementSequenceRegistry,
): void {
  if (!ts.isBlock(node)) return;
  const stmts = node.statements;
  const n = stmts.length;
  if (n < 3) return;
  const MAX_WINDOW = Math.min(n, 5);
  for (let size = 3; size <= MAX_WINDOW; size++) {
    for (let start = 0; start + size <= n; start++) {
      const window = stmts.slice(start, start + size);
      const texts = window.map((s) => s.getText(sourceFile));
      const joined = texts.join("\n");
      const normalized = normalizeText(joined);
      if (normalized.length < 128) continue;
      const hash = hashText(joined.replace(/\s+/g, " ").trim());
      const normalizedHash = hashText(normalized);
      const firstStmt = window[0];
      const lastStmt = window[window.length - 1];
      if (firstStmt === undefined || lastStmt === undefined) continue;
      const line = ts.getLineAndCharacterOfPosition(sourceFile, firstStmt.getStart(sourceFile)).line + 1;
      const endLine = ts.getLineAndCharacterOfPosition(sourceFile, lastStmt.getEnd()).line + 1;
      registry.add({ file, line, endLine, hash, normalizedHash, statementCount: size, normalizedBodyLength: normalized.length });
    }
  }
}

function collectInlineParamTypes(
  node: ts.Node,
  file: string,
  sourceFile: ts.SourceFile,
  registry: InlineParamTypeRegistry,
): void {
  if (!isInlineParamType(node)) return;
  const line = ts.getLineAndCharacterOfPosition(sourceFile, node.getStart(sourceFile)).line + 1;
  registry.add(file, line, node as ts.TypeLiteralNode, sourceFile);
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
    let resolvedDeclaration: ts.SignatureDeclaration | ts.JSDocSignature | undefined;
    try {
      symbol = checker.getSymbolAtLocation(node.expression);
      if (symbol && (symbol.flags & ts.SymbolFlags.Alias)) {
        symbol = checker.getAliasedSymbol(symbol);
      }
      const signature = checker.getResolvedSignature(node);
      resolvedDeclaration = signature?.declaration;
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
      resolvedDeclaration,
    });
  }
}

/** Collect all comments from a source file. */
export function collectAllComments(sourceFile: ts.SourceFile): CommentInfo[] {
  const comments: CommentInfo[] = [];
  const source = sourceFile.getFullText();
  const seen = new Set<number>();

  function addRanges(ranges: ts.CommentRange[] | undefined): void {
    if (!ranges) return;
    for (const r of ranges) {
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

  function visit(node: ts.Node): void {
    addRanges(ts.getLeadingCommentRanges(source, node.getFullStart()));
    addRanges(ts.getTrailingCommentRanges(source, node.getEnd()));
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);

  return comments;
}
