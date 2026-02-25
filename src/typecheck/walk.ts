import * as ts from "typescript";
import type { Diagnostic, TSRule, TSVisitContext } from "../rules/types.ts";
import { isNullableType, isFromNodeModules } from "./utils.ts";

export function runTSRules(
  rules: TSRule[],
  sourceFile: ts.SourceFile,
  checker: ts.TypeChecker,
  source: string,
  filename: string,
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  const contexts = rules.map((rule) => ({
    rule,
    ctx: buildContext(rule, sourceFile, checker, source, filename, diagnostics),
  }));

  function visit(node: ts.Node): void {
    for (const { rule, ctx } of contexts) {
      rule.visit(node, ctx);
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return diagnostics;
}

function buildContext(
  rule: TSRule,
  sourceFile: ts.SourceFile,
  checker: ts.TypeChecker,
  source: string,
  filename: string,
  diagnostics: Diagnostic[],
): TSVisitContext {
  return {
    filename,
    source,
    sourceFile,
    checker,

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

    isNullable(node: ts.Node): boolean {
      const type = checker.getTypeAtLocation(node);
      return isNullableType(checker, type);
    },

    isExternal(node: ts.Node): boolean {
      const type = checker.getTypeAtLocation(node);
      const symbol = type.getSymbol();
      if (!symbol) return false;
      const declarations = symbol.getDeclarations();
      if (!declarations || declarations.length === 0) return false;
      return declarations.some((d) => isFromNodeModules(d));
    },
  };
}
