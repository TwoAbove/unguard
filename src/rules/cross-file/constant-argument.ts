import type { ArgShape } from "../../graph/types.ts";
import type { CrossFileRule, Diagnostic } from "../types.ts";
import { signatureChangeCallers } from "./callers.ts";

/**
 * A parameter that receives the identical literal at every call site is not
 * really a parameter — the "choice" it offers is never exercised. Inline the
 * value and fold any branching on it.
 */
export const constantArgument: CrossFileRule = {
  id: "constant-argument",
  severity: "warning",
  message: "Parameter receives the same literal at every call site; inline the value",

  analyze(graph): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];

    for (const fn of graph.functions()) {
      const callers = signatureChangeCallers(graph, fn, 3);
      if (callers === null) continue;

      for (let i = 0; i < fn.params.length; i++) {
        const param = fn.params[i];
        if (param === undefined) continue;

        const first: ArgShape | undefined = callers[0]?.args[i];
        if (first?.kind !== "literal") continue;
        const firstText: string = first.text;
        if (
          !callers.every((call) => {
            const arg = call.args[i];
            return arg?.kind === "literal" && arg.text === firstText;
          })
        ) {
          continue;
        }

        diagnostics.push({
          ruleId: this.id,
          severity: this.severity,
          message: `Parameter "${param.name}" receives ${firstText} at all ${callers.length} call sites; inline the value and remove the parameter`,
          file: fn.site.file,
          line: fn.site.line,
          column: fn.site.column,
        });
      }
    }

    return diagnostics;
  },
};

