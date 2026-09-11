import type { CrossFileRule, Diagnostic } from "../types.ts";

export const trivialWrapper: CrossFileRule = {
  id: "trivial-wrapper",
  severity: "warning",
  message:
    "Function is a trivial wrapper that delegates without transformation; consider using the target directly",

  analyze(graph): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    const functions = graph.functions();
    const functionsById = new Map(functions.map((fn) => [fn.id, fn]));
    const callsById = new Map(graph.calls().map((call) => [call.id, call]));

    for (const fn of functions) {
      if (fn.soleCall === null) continue;
      if (fn.hasTypePredicateReturn || fn.hasTypeParameters) continue;

      const call = callsById.get(fn.soleCall);
      if (call === undefined || call.callee === null || call.callee === fn.id) continue;
      if (call.hasTypeArguments || call.args.length !== fn.params.length) continue;
      if (
        call.args.some((arg, index) =>
          arg.kind !== "identifier" || arg.decl !== fn.params[index]?.id
        )
      ) {
        continue;
      }

      const callee = functionsById.get(call.callee);
      if (callee === undefined) continue;
      diagnostics.push({
        ruleId: this.id,
        severity: this.severity,
        message: `Function "${fn.name}" trivially wraps "${callee.name}" without transformation`,
        file: fn.site.file,
        line: fn.site.line,
        column: fn.site.column,
      });
    }

    return diagnostics;
  },
};
