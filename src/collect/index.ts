import * as ts from "typescript";
import { createHash } from "node:crypto";
import { TypeRegistry } from "./type-registry.ts";
import { FunctionRegistry, type FunctionEntry, type ParamInfo } from "./function-registry.ts";
import { ConstantRegistry } from "./constant-registry.ts";
import { analyzeFunctionBody, hashText, normalizeText, type FunctionBodyAnalysis } from "../utils/hash.ts";
import { StatementSequenceRegistry, type StatementSequenceEntry } from "./statement-sequence-registry.ts";
import { InlineParamTypeRegistry } from "./inline-type-registry.ts";
import type { Diagnostic, ProjectIndexNeed, SemanticServices, TSRule, TSVisitContext } from "../rules/types.ts";
import { buildContext } from "../typecheck/walk.ts";
import { isInlineParamType } from "../typecheck/utils.ts";
import { SemanticCache } from "../typecheck/semantic-cache.ts";

export interface CommentInfo {
  type: "Line" | "Block";
  value: string;
  start: number;
  end: number;
}

const commentCache = new WeakMap<ts.SourceFile, CommentInfo[]>();

export interface ProjectIndex {
  types: TypeRegistry;
  functions: FunctionRegistry;
  constants: ConstantRegistry;
  callSites: CallSite[];
  imports: ImportEntry[];
  files: Map<string, { source: string; sourceFile: ts.SourceFile }>;
  /** Whitespace-normalized file content hash → list of file paths */
  fileHashes: Map<string, string[]>;
  statementSequences: StatementSequenceRegistry;
  inlineParamTypes: InlineParamTypeRegistry;
}

export interface CollectProjectOptions {
  /**
   * Restrict registry/index collection to these files while keeping the full
   * ts.Program available for type resolution.
   */
  collectFiles?: Set<string>;
  needs?: ProjectIndexNeeds;
  index?: ProjectIndex;
}

export interface SyntaxFileAnalysis {
  diagnostics: Diagnostic[];
}

export interface CollectSourceTextOptions {
  index?: ProjectIndex;
  needs?: ProjectIndexNeeds;
  retainFile?: boolean;
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

interface RuleContext {
  rule: TSRule;
  ctx: TSVisitContext;
}

interface RuleDispatch {
  byKind: Map<ts.SyntaxKind, RuleContext[]>;
  global: RuleContext[];
}

export type ProjectIndexNeeds = ReadonlySet<ProjectIndexNeed>;

const ALL_PROJECT_INDEX_NEEDS: ProjectIndexNeeds = new Set<ProjectIndexNeed>([
  "files",
  "types",
  "functions",
  "functionSymbols",
  "constants",
  "callSites",
  "callSiteSymbols",
  "overloadCallSignatures",
  "imports",
  "fileHashes",
  "statementSequences",
  "inlineParamTypes",
]);

export function createProjectIndex(): ProjectIndex {
  return {
    types: new TypeRegistry(),
    functions: new FunctionRegistry(),
    constants: new ConstantRegistry(),
    callSites: [],
    imports: [],
    files: new Map(),
    fileHashes: new Map(),
    statementSequences: new StatementSequenceRegistry(),
    inlineParamTypes: new InlineParamTypeRegistry(),
  };
}

export function collectSourceText(
  file: string,
  source: string,
  tsRules: TSRule[],
  options: CollectSourceTextOptions = {},
): SyntaxFileAnalysis {
  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, scriptKindForFile(file));
  const diagnostics: Diagnostic[] = [];
  const semantics = buildUnavailableSemantics(file);
  const needs = options.needs ?? new Set<ProjectIndexNeed>();
  const index = options.index;

  if (index !== undefined) {
    if (needs.has("fileHashes")) addFileHash(index, file, source);
  }

  const ruleDispatch = buildRuleDispatch(tsRules.map((rule) => ({
    rule,
    ctx: buildSyntaxContext(rule, sourceFile, source, file, diagnostics),
  })));

  function visit(node: ts.Node): void {
    visitRuleContexts(node, ruleDispatch);
    if (index !== undefined && needs.size > 0) {
      collectIndexNode(node, file, sourceFile, semantics, index, needs);
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  if (index !== undefined && options.retainFile !== false) {
    index.files.set(file, { source, sourceFile });
  }

  return { diagnostics };
}

function scriptKindForFile(file: string): ts.ScriptKind {
  if (file.endsWith(".tsx")) return ts.ScriptKind.TSX;
  if (file.endsWith(".jsx")) return ts.ScriptKind.JSX;
  if (file.endsWith(".js") || file.endsWith(".mjs") || file.endsWith(".cjs")) return ts.ScriptKind.JS;
  if (file.endsWith(".json")) return ts.ScriptKind.JSON;
  return ts.ScriptKind.TS;
}

function buildSyntaxContext(
  rule: TSRule,
  sourceFile: ts.SourceFile,
  source: string,
  filename: string,
  diagnostics: Diagnostic[],
): TSVisitContext {
  const checker = buildUnavailableChecker(`rule "${rule.id}"`);
  const semantics = buildUnavailableSemantics(`rule "${rule.id}"`);

  return {
    filename,
    source,
    sourceFile,
    checker,
    semantics,

    report(node: ts.Node, message?: string) {
      const { line, character } = ts.getLineAndCharacterOfPosition(sourceFile, node.getStart(sourceFile));
      diagnostics.push({
        ruleId: rule.id,
        severity: rule.severity,
        message: message ?? rule.message,
        file: filename,
        line: line + 1,
        column: character + 1,
      });
    },

    reportAtOffset(offset: number, message?: string) {
      const { line, character } = ts.getLineAndCharacterOfPosition(sourceFile, offset);
      diagnostics.push({
        ruleId: rule.id,
        severity: rule.severity,
        message: message ?? rule.message,
        file: filename,
        line: line + 1,
        column: character + 1,
      });
    },

    isNullable: unavailableTypeInfo,
    isExternal: unavailableTypeInfo,
  };
}

function buildUnavailableChecker(label: string): ts.TypeChecker {
  return new Proxy({}, {
    get(): never {
      throw new Error(`${label} requires type checking and cannot run in source-only mode.`);
    },
  }) as ts.TypeChecker;
}

function unavailableTypeInfo(): never {
  throw new Error("This rule requires type checking and cannot run in source-only mode.");
}

function buildUnavailableSemantics(label: string): SemanticServices {
  const checker = buildUnavailableChecker(label);
  return {
    checker,
    typeAtLocation: unavailableTypeInfo,
    symbolAtLocation: unavailableTypeInfo,
    resolvedSignature: unavailableTypeInfo,
    typeFromTypeNode: unavailableTypeInfo,
    contextualType: unavailableTypeInfo,
    typeOfSymbolAtLocation: unavailableTypeInfo,
    aliasedSymbol: unavailableTypeInfo,
    awaitedType: unavailableTypeInfo,
    apparentType: unavailableTypeInfo,
    isArrayType: unavailableTypeInfo,
    isTupleType: unavailableTypeInfo,
    isTypeAssignableTo: unavailableTypeInfo,
  };
}

export function collectProject(
  program: ts.Program,
  tsRules?: TSRule[],
  allowedFiles?: Set<string>,
  options: CollectProjectOptions = {},
): { index: ProjectIndex; diagnostics: Diagnostic[] } {
  const index = options.index ?? createProjectIndex();
  const needs = options.needs ?? ALL_PROJECT_INDEX_NEEDS;
  const checker = program.getTypeChecker();
  const semantics = new SemanticCache(checker);
  const diagnostics: Diagnostic[] = [];
  const overloadCalleeNames = needs.has("overloadCallSignatures")
    ? collectOverloadCalleeNames(program, options.collectFiles ?? allowedFiles)
    : undefined;

  for (const sourceFile of program.getSourceFiles()) {
    const file = sourceFile.fileName;
    if (sourceFile.isDeclarationFile) continue;
    if (file.includes("node_modules")) continue;

    const isReportable = !allowedFiles || allowedFiles.has(file);
    const shouldCollect = options.collectFiles === undefined || options.collectFiles.has(file);
    if (!isReportable && !shouldCollect) continue;
    const source = sourceFile.getFullText();

    if (isReportable || (shouldCollect && needs.has("files"))) {
      index.files.set(file, { source, sourceFile });
    }
    if (shouldCollect && needs.has("fileHashes")) {
      addFileHash(index, file, source);
    }

    const ruleDispatch = isReportable
      ? buildRuleDispatch(tsRules?.map((rule) => ({
          rule,
          ctx: buildContext(rule, sourceFile, semantics, source, file, diagnostics),
        })) ?? [])
      : undefined;

    function visit(node: ts.Node): void {
      if (shouldCollect) {
        collectIndexNode(node, file, sourceFile, semantics, index, needs, overloadCalleeNames);
      }
      if (ruleDispatch) {
        visitRuleContexts(node, ruleDispatch);
      }
      ts.forEachChild(node, visit);
    }
    visit(sourceFile);
  }

  return { index, diagnostics };
}

function collectIndexNode(
  node: ts.Node,
  file: string,
  sourceFile: ts.SourceFile,
  semantics: SemanticServices,
  index: ProjectIndex,
  needs: ProjectIndexNeeds,
  overloadCalleeNames?: Set<string>,
): void {
  switch (node.kind) {
    case ts.SyntaxKind.TypeAliasDeclaration:
    case ts.SyntaxKind.InterfaceDeclaration:
      if (!needs.has("types")) return;
      collectTypes(node, file, sourceFile, index.types);
      return;
    case ts.SyntaxKind.VariableStatement:
      if (needs.has("functions")) {
        collectFunctions(node, file, sourceFile, semantics, index.functions, needs.has("functionSymbols"));
      }
      if (needs.has("constants")) {
        collectConstants(node, file, sourceFile, index.constants);
      }
      return;
    case ts.SyntaxKind.FunctionDeclaration:
    case ts.SyntaxKind.PropertyAssignment:
    case ts.SyntaxKind.ArrowFunction:
    case ts.SyntaxKind.FunctionExpression:
    case ts.SyntaxKind.MethodDeclaration:
      if (needs.has("functions")) {
        collectFunctions(node, file, sourceFile, semantics, index.functions, needs.has("functionSymbols"));
      }
      return;
    case ts.SyntaxKind.CallExpression:
      if (!needs.has("callSites")) return;
      collectCallSites(
        node,
        file,
        sourceFile,
        semantics,
        index.callSites,
        needs.has("callSiteSymbols"),
        needs.has("overloadCallSignatures"),
        overloadCalleeNames,
      );
      return;
    case ts.SyntaxKind.Block:
      if (!needs.has("statementSequences")) return;
      collectStatementSequences(node, file, sourceFile, index.statementSequences);
      return;
    case ts.SyntaxKind.TypeLiteral:
      if (!needs.has("inlineParamTypes")) return;
      collectInlineParamTypes(node, file, sourceFile, index.inlineParamTypes);
      return;
    case ts.SyntaxKind.ImportDeclaration:
    case ts.SyntaxKind.ExportDeclaration:
      if (!needs.has("imports")) return;
      collectImports(node, file, index.imports);
      return;
  }
}

function addFileHash(index: ProjectIndex, file: string, source: string): void {
  const normalized = source.replace(/\s+/g, " ").trim();
  const hash = createHash("sha256").update(normalized).digest("hex").slice(0, 16);
  let list = index.fileHashes.get(hash);
  if (list === undefined) {
    list = [];
    index.fileHashes.set(hash, list);
  }
  if (!list.includes(file)) list.push(file);
}

function buildRuleDispatch(ruleContexts: RuleContext[]): RuleDispatch {
  const byKind = new Map<ts.SyntaxKind, RuleContext[]>();
  const global: RuleContext[] = [];

  for (const ruleContext of ruleContexts) {
    const kinds = ruleContext.rule.syntaxKinds;
    if (kinds === undefined) {
      global.push(ruleContext);
      continue;
    }
    for (const kind of kinds) {
      let contexts = byKind.get(kind);
      if (contexts === undefined) {
        contexts = [];
        byKind.set(kind, contexts);
      }
      contexts.push(ruleContext);
    }
  }

  return { byKind, global };
}

function visitRuleContexts(node: ts.Node, ruleDispatch: RuleDispatch): void {
  const contexts = ruleDispatch.byKind.get(node.kind);
  if (contexts !== undefined) {
    for (const { rule, ctx } of contexts) {
      rule.visit(node, ctx);
    }
  }
  for (const { rule, ctx } of ruleDispatch.global) {
    rule.visit(node, ctx);
  }
}

function collectOverloadCalleeNames(
  program: ts.Program,
  collectFiles: Set<string> | undefined,
): Set<string> {
  const overloaded = new Set<string>();

  for (const sourceFile of program.getSourceFiles()) {
    if (sourceFile.isDeclarationFile) continue;
    if (sourceFile.fileName.includes("node_modules")) continue;
    if (collectFiles !== undefined && !collectFiles.has(sourceFile.fileName)) continue;

    const implementations = new Set<string>();
    const signatures: string[] = [];

    function visit(node: ts.Node): void {
      if ((ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node)) && node.name !== undefined) {
        const name = node.name.getText(sourceFile);
        if (node.body === undefined) {
          signatures.push(name);
        } else {
          implementations.add(name);
        }
      }
      ts.forEachChild(node, visit);
    }

    visit(sourceFile);

    for (const name of signatures) {
      if (implementations.has(name)) overloaded.add(name);
    }
  }

  return overloaded;
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
  bodyAnalysis?: FunctionBodyAnalysis,
): FunctionEntry {
  const line = ts.getLineAndCharacterOfPosition(sourceFile, lineNode.getStart(sourceFile)).line + 1;
  const params = extractParams(parameters, sourceFile);
  const paramNames = params.map((p) => p.name);
  const analysis = bodyAnalysis ?? analyzeFunctionBody(body, sourceFile, paramNames);
  return {
    name,
    file,
    line,
    hash: analysis.hash,
    normalizedHash: analysis.normalizedHash,
    params,
    node: extra.node ?? body,
    exported: extra.exported ?? false,
    bodyLength: analysis.bodyLength,
    normalizedBodyLength: analysis.normalizedBodyLength,
    ...extra,
  };
}

function collectFunctions(
  node: ts.Node,
  file: string,
  sourceFile: ts.SourceFile,
  semantics: SemanticServices,
  registry: FunctionRegistry,
  resolveSymbols: boolean,
): void {
  if (ts.isFunctionDeclaration(node) && node.name && node.body) {
    registry.add(buildFunctionEntry(node.body, node.parameters, sourceFile, file, node, node.name.text, {
      exported: isExported(node), symbol: resolveSymbols ? semantics.symbolAtLocation(node.name) : undefined, node,
    }));
  }

  // Arrow functions and function expressions assigned to const: const foo = (...) => { ... } / const foo = function() { ... }
  if (ts.isVariableStatement(node)) {
    const exported = isExported(node);
    for (const decl of node.declarationList.declarations) {
      if (decl.initializer && ts.isArrowFunction(decl.initializer) && ts.isIdentifier(decl.name)) {
        const arrow = decl.initializer;
        registry.add(buildFunctionEntry(arrow.body, arrow.parameters, sourceFile, file, decl, decl.name.text, {
          exported, symbol: resolveSymbols ? semantics.symbolAtLocation(decl.name) : undefined, node: arrow,
        }));
      }
      if (decl.initializer && ts.isFunctionExpression(decl.initializer) && ts.isIdentifier(decl.name)) {
        const fn = decl.initializer;
        if (fn.body) {
          registry.add(buildFunctionEntry(fn.body, fn.parameters, sourceFile, file, decl, decl.name.text, {
            exported, symbol: resolveSymbols ? semantics.symbolAtLocation(decl.name) : undefined, node: fn,
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
      const body = ts.isArrowFunction(node) ? node.body : node.body;
      if (body) {
        const MIN_ANON_BODY = 64;
        const params = extractParams(node.parameters, sourceFile);
        const bodyAnalysis = analyzeFunctionBody(body, sourceFile, params.map((p) => p.name));
        if (bodyAnalysis.bodyLength >= MIN_ANON_BODY) {
          const name = deriveAnonymousName(node, sourceFile);
          registry.add(buildFunctionEntry(body, node.parameters, sourceFile, file, node, name, { node }, bodyAnalysis));
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
        exported: isExported(parent),
        symbol: resolveSymbols ? semantics.symbolAtLocation(node.name) : undefined,
        node,
        className,
        implementsInterface,
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

function collectCallSites(
  node: ts.Node,
  file: string,
  sourceFile: ts.SourceFile,
  semantics: SemanticServices,
  sites: CallSite[],
  resolveSymbol: boolean,
  resolveOverloadSignatures: boolean,
  overloadCalleeNames?: Set<string>,
): void {
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
    let symbol = resolveSymbol ? semantics.symbolAtLocation(node.expression) : undefined;
    if (symbol !== undefined && (symbol.flags & ts.SymbolFlags.Alias)) {
      symbol = semantics.aliasedSymbol(symbol);
    }
    const shouldResolveSignature = resolveOverloadSignatures && overloadCalleeNames?.has(calleeName) === true;
    const signature = shouldResolveSignature ? semantics.resolvedSignature(node) : undefined;
    const resolvedDeclaration = signature?.declaration;
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
  const cached = commentCache.get(sourceFile);
  if (cached !== undefined) return cached;

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

  commentCache.set(sourceFile, comments);
  return comments;
}
