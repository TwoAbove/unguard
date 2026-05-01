import * as ts from "typescript";
import { type CrossFileAnalysisContext, type CrossFileRule, type Diagnostic, type ProjectIndex, reportDuplicateGroup } from "../types.ts";

export const duplicateTypeDeclaration: CrossFileRule = {
  id: "duplicate-type-declaration",
  severity: "warning",
  message: "Identical type shape declared in multiple files; consolidate to a single definition",
  requires: ["types"],

  analyze(project: ProjectIndex, context: CrossFileAnalysisContext = {}): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    for (const group of project.types.getDuplicateGroups()) {
      const files = new Set(group.map((e) => e.file));
      if (files.size < 2) continue;
      if (group.every((e) => isTrivialObjectShape(e.node))) continue;
      reportDuplicateGroup(group, this.id, this.severity,
        (e) => `${e.name} (${e.file}:${e.line})`,
        (e, others) => `Type "${e.name}" has identical shape to: ${others}`,
        diagnostics,
        context);
    }
    return diagnostics;
  },
};

function isTrivialObjectShape(node: ts.Node): boolean {
  if (ts.isTypeLiteralNode(node)) return node.members.length <= 1;
  if (ts.isInterfaceDeclaration(node)) return node.members.length <= 1;
  return false;
}
