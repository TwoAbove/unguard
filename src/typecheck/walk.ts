import * as ts from "typescript";
import type { Diagnostic, FixEdit, SemanticServices, TSRule, TSVisitContext } from "../rules/types.ts";
import { isNullableType, isFromNodeModules } from "./utils.ts";
import { SemanticCache } from "./semantic-cache.ts";

export function buildContext(
  rule: TSRule,
  sourceFile: ts.SourceFile,
  semantics: SemanticServices,
  source: string,
  filename: string,
  diagnostics: Diagnostic[],
  compilerOptions: ts.CompilerOptions,
): TSVisitContext {
  const checker = semantics.checker;
  return {
    filename,
    source,
    sourceFile,
    checker,
    semantics,
    compilerOptions,

    report(node: ts.Node, message?: string, fix?: FixEdit) {
      const { line, character } = ts.getLineAndCharacterOfPosition(sourceFile, node.getStart(sourceFile));
      diagnostics.push({
        ruleId: rule.id,
        severity: rule.severity,
        message: message ?? rule.message,
        file: filename,
        line: line + 1,
        column: character + 1,
        fix,
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

    isNullable(node: ts.Node): boolean {
      const type = semantics.typeAtLocation(node);
      return isNullableType(checker, type);
    },

    isExternal(node: ts.Node): boolean {
      const type = semantics.typeAtLocation(node);
      const symbol = type.getSymbol();
      if (!symbol) return false;
      const declarations = symbol.getDeclarations();
      if (!declarations || declarations.length === 0) return false;
      return declarations.some((d) => isFromNodeModules(d));
    },
  };
}

interface RuleContext {
  rule: TSRule;
  ctx: TSVisitContext;
}

interface RuleDispatch {
  byKind: Map<ts.SyntaxKind, RuleContext[]>;
  global: RuleContext[];
}

export function runTSRules(
  program: ts.Program,
  tsRules: TSRule[],
  reportableFiles: ReadonlySet<string>,
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const compilerOptions = program.getCompilerOptions();
  const semantics = new SemanticCache(program.getTypeChecker());

  for (const sourceFile of program.getSourceFiles()) {
    const file = sourceFile.fileName;
    if (sourceFile.isDeclarationFile) continue;
    if (file.includes("node_modules")) continue;
    if (!reportableFiles.has(file)) continue;
    const source = sourceFile.getFullText();
    walkWithRules(sourceFile, tsRules.map((rule) => ({
      rule,
      ctx: buildContext(rule, sourceFile, semantics, source, file, diagnostics, compilerOptions),
    })));
  }

  return diagnostics;
}

export function runTSRulesOnSource(
  file: string,
  source: string,
  tsRules: TSRule[],
): { sourceFile: ts.SourceFile; diagnostics: Diagnostic[] } {
  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, scriptKindForFile(file));
  const diagnostics: Diagnostic[] = [];
  walkWithRules(sourceFile, tsRules.map((rule) => ({
    rule,
    ctx: buildSyntaxContext(rule, sourceFile, source, file, diagnostics),
  })));

  return { sourceFile, diagnostics };
}

function walkWithRules(sourceFile: ts.SourceFile, ruleContexts: RuleContext[]): void {
  const ruleDispatch = buildRuleDispatch(ruleContexts);
  const visit = (node: ts.Node): void => {
    visitRuleContexts(node, ruleDispatch);
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
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
    compilerOptions: {},

    report(node: ts.Node, message?: string, fix?: FixEdit) {
      const { line, character } = ts.getLineAndCharacterOfPosition(sourceFile, node.getStart(sourceFile));
      diagnostics.push({
        ruleId: rule.id,
        severity: rule.severity,
        message: message ?? rule.message,
        file: filename,
        line: line + 1,
        column: character + 1,
        fix,
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
    shorthandAssignmentValueSymbol: unavailableTypeInfo,
    awaitedType: unavailableTypeInfo,
    apparentType: unavailableTypeInfo,
    isArrayType: unavailableTypeInfo,
    isTupleType: unavailableTypeInfo,
    isTypeAssignableTo: unavailableTypeInfo,
  };
}
