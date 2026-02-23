import type { CrossFileRule, Diagnostic, ProjectIndex } from "../types.ts";
import { children } from "../../utils/narrow.ts";
import { isNullish } from "../../utils/ast.ts";

export const explicitNullArg: CrossFileRule = {
  id: "explicit-null-arg",
  severity: "warning",
  message: "Explicit null/undefined passed to a project function; consider redesigning the interface to not accept nullish values",

  analyze(project: ProjectIndex): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];

    // Build a set of known project function names for fast lookup
    const projectFnNames = new Set<string>();
    for (const fn of project.functions.getAll()) {
      projectFnNames.add(fn.name);
    }

    for (const site of project.callSites) {
      // Only flag calls to functions defined in the project
      if (!projectFnNames.has(site.calleeName)) continue;

      const args = children(site.node, "arguments");
      for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg === undefined) continue;
        if (isNullish(arg)) {
          const val = arg.type === "Literal" ? "null" : "undefined";
          diagnostics.push({
            ruleId: this.id,
            severity: this.severity,
            message: `Passing explicit ${val} to "${site.calleeName}" at argument ${i + 1}; consider redesigning the interface to not accept nullish values`,
            file: site.file,
            line: site.line,
            column: 1,
          });
          break; // one diagnostic per call site
        }
      }
    }

    return diagnostics;
  },
};
