import type { CrossFileRule, Diagnostic } from "../types.ts";

export const deadOverload: CrossFileRule = {
  id: "dead-overload",
  severity: "warning",
  message: "Overload signature has no matching call sites in the project",

  analyze(graph): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];

    for (const family of graph.overloadFamilies()) {
      const { signatures } = family;
      if (signatures.length < 2) continue;

      const implementationIndex = signatures.length - 1;
      if (!signatures[implementationIndex]?.hasBody) continue;
      if (signatures.slice(0, implementationIndex).some((signature) => signature.hasBody)) continue;

      const matched = new Set(
        graph.callers(family.id).flatMap((call) =>
          call.resolvedSignature === null ? [] : [call.resolvedSignature]
        ),
      );
      if (matched.size === 0) continue;

      for (let index = 0; index < implementationIndex; index++) {
        if (matched.has(index)) continue;
        const signature = signatures[index];
        if (signature === undefined) continue;
        diagnostics.push({
          ruleId: this.id,
          severity: this.severity,
          message: `Overload signature for "${family.name}" has no matching call sites in the project`,
          file: signature.site.file,
          line: signature.site.line,
          column: signature.site.column,
        });
      }
    }

    return diagnostics;
  },
};
