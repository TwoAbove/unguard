import * as ts from "typescript";
import type { CrossFileRule, Diagnostic, ProjectIndex } from "../types.ts";

const MODULE_SCOPE = -1;

interface LiteralOccurrence {
  line: number;
  isAsConst: boolean;
  scopeId: number;
  key: string;
}

export const repeatedLiteralProperty: CrossFileRule = {
  id: "repeated-literal-property",
  severity: "warning",
  message: "Repeated literal value in object properties; consider extracting a constant or factory",
  requires: ["files"],

  analyze(project: ProjectIndex): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];

    for (const [file, { sourceFile }] of project.files) {
      const valueMap = new Map<string, LiteralOccurrence[]>();

      function visit(node: ts.Node): void {
        if (ts.isObjectLiteralExpression(node)) {
          for (const prop of node.properties) {
            if (!ts.isPropertyAssignment(prop)) continue;
            const result = extractLiteral(prop.initializer, sourceFile);
            if (result.literalText === null) continue;
            let list = valueMap.get(result.literalText);
            if (!list) {
              list = [];
              valueMap.set(result.literalText, list);
            }
            const line = ts.getLineAndCharacterOfPosition(sourceFile, prop.getStart(sourceFile)).line + 1;
            const scopeId = findEnclosingFunctionStart(prop, sourceFile);
            const key = ts.isIdentifier(prop.name) ? prop.name.text
              : ts.isStringLiteral(prop.name) ? prop.name.text
              : "";
            list.push({ line, isAsConst: result.isAsConst, scopeId, key });
          }
        }
        ts.forEachChild(node, visit);
      }
      ts.forEachChild(sourceFile, visit);

      for (const [value, occurrences] of valueMap) {
        // All occurrences on the same property key = discriminant pattern, not a DRY violation
        const uniqueKeys = new Set(occurrences.map((o) => o.key).filter((k) => k !== ""));
        if (uniqueKeys.size === 1) continue;

        const hasAsConst = occurrences.some((o) => o.isAsConst);
        // Deduplicate by scope — count distinct functions, not raw occurrences
        const uniqueScopes = new Set(occurrences.map((o) => o.scopeId));
        const threshold = hasAsConst ? 3 : 5;
        if (uniqueScopes.size < threshold) continue;

        const sorted = [...occurrences].sort((a, b) => a.line - b.line);
        const first = sorted[0];
        if (first === undefined) continue;
        const otherLines = sorted.slice(1).map((o) => o.line).join(", ");
        diagnostics.push({
          ruleId: this.id,
          severity: this.severity,
          message: `${JSON.stringify(value)}${hasAsConst ? " as const" : ""} repeated across ${uniqueScopes.size} scopes as property value (also at lines ${otherLines})`,
          file,
          line: first.line,
          column: 1,
        });
      }
    }

    return diagnostics;
  },
};

function findEnclosingFunctionStart(node: ts.Node, sourceFile: ts.SourceFile): number {
  let current = node.parent;
  while (current) {
    if (
      ts.isFunctionDeclaration(current) ||
      ts.isFunctionExpression(current) ||
      ts.isArrowFunction(current) ||
      ts.isMethodDeclaration(current)
    ) {
      return current.getStart(sourceFile);
    }
    current = current.parent;
  }
  return MODULE_SCOPE;
}

function extractLiteral(
  node: ts.Node,
  sourceFile: ts.SourceFile,
): { literalText: string | null; isAsConst: boolean } {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return { literalText: node.text, isAsConst: false };
  }

  if (ts.isAsExpression(node) && node.type.getText(sourceFile).trim() === "const") {
    const inner = extractLiteral(node.expression, sourceFile);
    if (inner.literalText !== null) {
      return { literalText: inner.literalText, isAsConst: true };
    }
  }

  return { literalText: null, isAsConst: false };
}
