import * as ts from "typescript";
import type { Diagnostic, SemanticServices, TSRule, TSVisitContext } from "../rules/types.ts";
import { isNullableType, isFromNodeModules } from "./utils.ts";

export function buildContext(
  rule: TSRule,
  sourceFile: ts.SourceFile,
  semantics: SemanticServices,
  source: string,
  filename: string,
  diagnostics: Diagnostic[],
): TSVisitContext {
  const checker = semantics.checker;
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
