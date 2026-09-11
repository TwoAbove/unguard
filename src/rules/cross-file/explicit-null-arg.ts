import type { CrossFileRule, Diagnostic } from "../types.ts";

export const explicitNullArg: CrossFileRule = {
  id: "explicit-null-arg",
  severity: "warning",
  message: "Explicit null/undefined passed to a project function; consider redesigning the interface to not accept nullish values",

  analyze(graph): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    const functions = new Map(graph.functions().map((fn) => [fn.id, fn]));

    for (const call of graph.calls()) {
      if (call.callee === null) continue;
      const callee = functions.get(call.callee);
      if (callee === undefined) continue;

      for (let i = 0; i < call.args.length; i++) {
        const arg = call.args[i];
        if (arg?.kind !== "literal" || (arg.text !== "null" && arg.text !== "undefined")) continue;
        diagnostics.push({
          ruleId: this.id,
          severity: this.severity,
          message: `Passing explicit ${arg.text} to "${callee.name}" at argument ${i + 1}; consider redesigning the interface to not accept nullish values`,
          file: call.site.file,
          line: call.site.line,
          column: call.site.column,
        });
        break;
      }
    }

    return diagnostics;
  },
};
