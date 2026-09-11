import type { Graph, NodeId, ObjectLiteralFact } from "../../graph/types.ts";
import type { CrossFileRule, Diagnostic } from "../types.ts";

const MODULE_SCOPE = "<module>";

interface LiteralOccurrence {
  line: number;
  isAsConst: boolean;
  scopeId: NodeId | typeof MODULE_SCOPE;
  key: string;
}

export const repeatedLiteralProperty: CrossFileRule = {
  id: "repeated-literal-property",
  severity: "warning",
  message: "Repeated literal value in object properties; consider extracting a constant or factory",
  requiresTypeInfo: false,

  analyze(graph: Graph): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    const literalsByFile = new Map<string, ObjectLiteralFact[]>();

    for (const literal of graph.objectLiterals()) {
      const literals = literalsByFile.get(literal.site.file);
      if (literals === undefined) {
        literalsByFile.set(literal.site.file, [literal]);
      } else {
        literals.push(literal);
      }
    }

    for (const [file, literals] of literalsByFile) {
      const valueMap = new Map<string, LiteralOccurrence[]>();
      for (const literal of literals) {
        for (const property of literal.properties) {
          if (property.literalText === null) continue;
          let occurrences = valueMap.get(property.literalText);
          if (occurrences === undefined) {
            occurrences = [];
            valueMap.set(property.literalText, occurrences);
          }
          occurrences.push({
            line: property.site.line,
            isAsConst: property.isAsConst,
            scopeId: literal.enclosingFunction?.id ?? MODULE_SCOPE,
            key: property.key,
          });
        }
      }

      for (const [value, occurrences] of valueMap) {
        // All occurrences on the same property key = discriminant pattern, not a DRY violation
        const uniqueKeys = new Set(occurrences.map((occurrence) => occurrence.key).filter((key) => key !== ""));
        if (uniqueKeys.size === 1) continue;

        const hasAsConst = occurrences.some((occurrence) => occurrence.isAsConst);
        // Deduplicate by scope — count distinct functions, not raw occurrences
        const uniqueScopes = new Set(occurrences.map((occurrence) => occurrence.scopeId));
        const threshold = hasAsConst ? 3 : 5;
        if (uniqueScopes.size < threshold) continue;

        const sorted = [...occurrences].sort((a, b) => a.line - b.line);
        const first = sorted[0];
        if (first === undefined) continue;
        const otherLines = sorted
          .slice(1)
          .map((occurrence) => occurrence.line)
          .join(", ");
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
