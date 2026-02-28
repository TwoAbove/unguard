import * as ts from "typescript";
import { type CrossFileRule, type Diagnostic, type ProjectIndex, reportDuplicateGroup } from "../types.ts";

export const duplicateTypeName: CrossFileRule = {
  id: "duplicate-type-name",
  severity: "warning",
  message: "Same type name exported from multiple files; consolidate or rename to avoid ambiguity",

  analyze(project: ProjectIndex): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    for (const group of project.types.getNameCollisionGroups()) {
      const hashes = new Set(group.map((e) => e.hash));
      if (hashes.size === 1) continue;

      const hasInferredType = group.some(
        (e) => !ts.isTypeLiteralNode(e.node) && !ts.isInterfaceDeclaration(e.node),
      );
      if (hasInferredType) continue;

      reportDuplicateGroup(group, this.id, this.severity,
        (e) => `${e.file}:${e.line}`,
        (e, others) => `Exported type "${e.name}" also defined in: ${others}`,
        diagnostics);
    }
    return diagnostics;
  },
};
