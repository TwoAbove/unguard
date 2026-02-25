import type { CrossFileRule, Diagnostic, ProjectIndex } from "../types.ts";

export const duplicateTypeName: CrossFileRule = {
  id: "duplicate-type-name",
  severity: "error",
  message: "Same type name exported from multiple files; consolidate or rename to avoid ambiguity",

  analyze(project: ProjectIndex): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    for (const group of project.types.getNameCollisionGroups()) {
      // Skip groups already caught by duplicate-type-declaration (identical shapes)
      const hashes = new Set(group.map((e) => e.hash));
      if (hashes.size === 1) continue;

      // Skip if any entry is an inferred/reference type (Awaited<ReturnType<...>>, z.infer<...>, etc.)
      // rather than a structural definition — these are intentionally derived, not duplicated
      const hasInferredType = group.some(
        (e) => e.node.type !== "TSTypeLiteral" && e.node.type !== "TSInterfaceBody",
      );
      if (hasInferredType) continue;

      const sorted = [...group].sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);
      for (const entry of sorted.slice(1)) {
        const others = sorted
          .filter((e) => e !== entry)
          .map((e) => `${e.file}:${e.line}`)
          .join(", ");
        diagnostics.push({
          ruleId: this.id,
          severity: this.severity,
          message: `Exported type "${entry.name}" also defined in: ${others}`,
          file: entry.file,
          line: entry.line,
          column: 1,
        });
      }
    }
    return diagnostics;
  },
};
