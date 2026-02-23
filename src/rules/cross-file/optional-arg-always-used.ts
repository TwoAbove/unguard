import type { CrossFileRule, Diagnostic, ProjectIndex } from "../types.ts";

export const optionalArgAlwaysUsed: CrossFileRule = {
  id: "optional-arg-always-used",
  severity: "warning",
  message: "Optional parameter is always provided at every call site; make it required",

  analyze(project: ProjectIndex): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];

    for (const fn of project.functions.getAll()) {
      // Find optional params (by index)
      for (let i = 0; i < fn.params.length; i++) {
        const param = fn.params[i];
        if (!param.optional && !param.hasDefault) continue;

        // Find all call sites matching this function name
        const callSites = project.callSites.filter((c) => c.calleeName === fn.name);

        // Need at least 2 call sites to be meaningful
        if (callSites.length < 2) continue;

        // Check if every call site provides this positional argument
        const allProvide = callSites.every((c) => c.argCount > i);
        if (allProvide) {
          diagnostics.push({
            ruleId: this.id,
            severity: this.severity,
            message: `Optional parameter "${param.name}" is always provided at all ${callSites.length} call sites; make it required`,
            file: fn.file,
            line: fn.line,
            column: 1,
          });
        }
      }
    }

    return diagnostics;
  },
};
