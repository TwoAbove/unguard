import * as ts from "typescript";
import type { CrossFileRule, Diagnostic, ProjectIndex } from "../types.ts";

interface LiteralOccurrence {
  line: number;
  isAsConst: boolean;
}

export const repeatedLiteralProperty: CrossFileRule = {
  id: "repeated-literal-property",
  severity: "warning",
  message: "Repeated literal value in object properties; consider extracting a constant or factory",

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
            list.push({ line, isAsConst: result.isAsConst });
          }
        }
        ts.forEachChild(node, visit);
      }
      ts.forEachChild(sourceFile, visit);

      for (const [value, occurrences] of valueMap) {
        const hasAsConst = occurrences.some((o) => o.isAsConst);
        const threshold = hasAsConst ? 3 : 5;
        if (occurrences.length < threshold) continue;

        const sorted = [...occurrences].sort((a, b) => a.line - b.line);
        for (const occ of sorted) {
          const otherLines = sorted
            .filter((o) => o !== occ)
            .map((o) => o.line)
            .join(", ");
          diagnostics.push({
            ruleId: this.id,
            severity: this.severity,
            message: `${JSON.stringify(value)}${hasAsConst ? " as const" : ""} repeated ${occurrences.length} times as property value (also at lines ${otherLines})`,
            file,
            line: occ.line,
            column: 1,
          });
        }
      }
    }

    return diagnostics;
  },
};

function extractLiteral(
  node: ts.Node,
  sourceFile: ts.SourceFile,
): { literalText: string | null; isAsConst: boolean } {
  if (ts.isStringLiteral(node) || ts.isNumericLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return { literalText: node.text, isAsConst: false };
  }
  if (node.kind === ts.SyntaxKind.TrueKeyword) return { literalText: "true", isAsConst: false };
  if (node.kind === ts.SyntaxKind.FalseKeyword) return { literalText: "false", isAsConst: false };

  if (ts.isAsExpression(node) && node.type.getText(sourceFile).trim() === "const") {
    const inner = extractLiteral(node.expression, sourceFile);
    if (inner.literalText !== null) {
      return { literalText: inner.literalText, isAsConst: true };
    }
  }

  return { literalText: null, isAsConst: false };
}
