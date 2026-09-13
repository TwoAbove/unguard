import type { Graph, NodeId } from "../../graph/types.ts";
import {
  type CrossFileAnalysisContext,
  type CrossFileRule,
  type Diagnostic,
  selectReportTarget,
} from "../types.ts";

interface ReturnShapeEntry {
  file: string;
  line: number;
  functionId: NodeId;
  functionName: string;
  props: string[];
}

export const repeatedReturnShape: CrossFileRule = {
  id: "repeated-return-shape",
  severity: "warning",
  message: "Multiple functions return the same object shape; consider a shared return type",
  requiresTypeInfo: false,

  analyze(graph: Graph, context: CrossFileAnalysisContext = {}): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    const THRESHOLD = 3;
    const shapeMap = new Map<string, ReturnShapeEntry[]>();

    for (const literal of graph.objectLiterals()) {
      const enclosingFunction = literal.enclosingFunction;
      if (
        literal.role !== "return" ||
        literal.propertyNames === null ||
        literal.propertyNames.length < 2 ||
        enclosingFunction === null ||
        enclosingFunction.isCallbackArgument ||
        enclosingFunction.hasReturnTypeAnnotation
      ) {
        continue;
      }

      const { sorted, list } = getShapeGroup(shapeMap, literal.propertyNames);
      list.push({
        file: literal.site.file,
        line: enclosingFunction.site.line,
        functionId: enclosingFunction.id,
        functionName: enclosingFunction.name,
        props: sorted,
      });
    }

    const knownTypeShapes = new Set<string>();
    for (const type of graph.types()) {
      if (type.propertyNames !== null && type.propertyNames.length >= 2) {
        knownTypeShapes.add([...type.propertyNames].sort().join("\0"));
      }
    }

    for (const [shapeKey, entries] of shapeMap) {
      if (knownTypeShapes.has(shapeKey)) continue;
      const byFunction = new Map<NodeId, ReturnShapeEntry>();
      for (const entry of entries) {
        if (!byFunction.has(entry.functionId)) byFunction.set(entry.functionId, entry);
      }
      const unique = [...byFunction.values()];
      if (unique.length < THRESHOLD) continue;

      // Same-file repetition is visible and likely intentional (protocol/framework pattern).
      // Only flag shapes that span multiple files — that's where the developer can't see the duplication.
      const uniqueFiles = new Set(unique.map((entry) => entry.file));
      if (uniqueFiles.size < 2) continue;

      const sorted = unique.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);
      const target = selectReportTarget(sorted, context.reportableFiles);
      if (target === undefined) continue;
      const others = sorted
        .filter((entry) => entry !== target)
        .map((entry) => `${entry.functionName} (${entry.file}:${entry.line})`)
        .join(", ");
      diagnostics.push({
        ruleId: this.id,
        severity: this.severity,
        message: `${unique.length} functions return shape {${target.props.join(", ")}}; consider a shared return type (${others})`,
        file: target.file,
        line: target.line,
        column: 1,
      });
    }

    return diagnostics;
  },
};

function getShapeGroup<T>(map: Map<string, T[]>, props: string[]): { sorted: string[]; list: T[] } {
  const sorted = [...props].sort();
  const key = sorted.join("\0");
  let list = map.get(key);
  if (list === undefined) {
    list = [];
    map.set(key, list);
  }
  return { sorted, list };
}
