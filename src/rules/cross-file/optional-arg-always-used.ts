import type { CrossFileRule, Diagnostic } from "../types.ts";
import { signatureChangeCallers } from "./callers.ts";

export const optionalArgAlwaysUsed: CrossFileRule = {
  id: "optional-arg-always-used",
  severity: "warning",
  message: "Optional parameter is always provided at every call site; make it required",

  analyze(graph): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];

    for (const fn of graph.functions()) {
      const callers = signatureChangeCallers(graph, fn, 2);
      if (callers === null) continue;

      for (let i = 0; i < fn.params.length; i++) {
        const param = fn.params[i];
        if (param === undefined || (!param.optional && !param.hasDefault)) continue;
        if (!callers.every((call) => call.args.length > i)) continue;
        diagnostics.push({
          ruleId: this.id,
          severity: this.severity,
          message: `Optional parameter "${param.name}" is always provided at all ${callers.length} call sites; make it required`,
          file: fn.site.file,
          line: fn.site.line,
          column: fn.site.column,
        });
      }
    }

    return diagnostics;
  },
};
