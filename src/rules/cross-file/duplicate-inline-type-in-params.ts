import type { Graph } from "../../graph/types.ts";
import {
  type CrossFileAnalysisContext,
  type CrossFileRule,
  type Diagnostic,
  reportDuplicateGroup,
} from "../types.ts";

export const duplicateInlineTypeInParams: CrossFileRule = {
  id: "duplicate-inline-type-in-params",
  severity: "warning",
  message: "Same inline param type shape appears in multiple places; extract to a shared named type",
  requiresTypeInfo: false,

  analyze(graph: Graph, context: CrossFileAnalysisContext = {}): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    for (const group of graph.duplicateGroups("inline-param-type")) {
      const entries = group.map((entry) => ({
        typeText: entry.typeText,
        file: entry.site.file,
        line: entry.site.line,
        column: entry.site.column,
      }));
      reportDuplicateGroup(
        entries,
        this.id,
        this.severity,
        (entry) => `${entry.typeText} (${entry.file}:${entry.line})`,
        (entry, others) => `Inline param type \`${entry.typeText}\` also appears at: ${others}`,
        diagnostics,
        context,
      );
    }
    return diagnostics;
  },
};
