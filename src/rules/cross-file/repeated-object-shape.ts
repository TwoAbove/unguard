import * as ts from "typescript";
import type { CrossFileRule, Diagnostic, ProjectIndex } from "../types.ts";
import { extractPropertyNames, getShapeGroup } from "./object-shape.ts";

export const repeatedObjectShape: CrossFileRule = {
  id: "repeated-object-shape",
  severity: "warning",
  message: "Repeated object literal shape; consider extracting a type and factory",

  analyze(project: ProjectIndex): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    const THRESHOLD = 5;

    for (const [file, { sourceFile }] of project.files) {
      const shapeMap = new Map<string, { line: number; props: string[] }[]>();

      function visit(node: ts.Node): void {
        if (ts.isObjectLiteralExpression(node)) {
          const props = extractPropertyNames(node);
          if (props !== null && props.length > 0) {
            const { sorted, list } = getShapeGroup(shapeMap, props);
            const line = ts.getLineAndCharacterOfPosition(sourceFile, node.getStart(sourceFile)).line + 1;
            list.push({ line, props: sorted });
          }
        }
        ts.forEachChild(node, visit);
      }
      ts.forEachChild(sourceFile, visit);

      for (const [, occurrences] of shapeMap) {
        if (occurrences.length < THRESHOLD) continue;

        const sorted = [...occurrences].sort((a, b) => a.line - b.line);
        for (const occ of sorted) {
          const otherLines = sorted
            .filter((o) => o !== occ)
            .map((o) => o.line)
            .join(", ");
          diagnostics.push({
            ruleId: this.id,
            severity: this.severity,
            message: `Object shape {${occ.props.join(", ")}} appears ${occurrences.length} times (also at lines ${otherLines})`,
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
