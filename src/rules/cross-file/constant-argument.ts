import * as ts from "typescript";
import type { CrossFileRule, Diagnostic, ProjectIndex } from "../types.ts";
import { signatureChangeCallSites } from "./call-site-utils.ts";

/**
 * A parameter that receives the identical literal at every call site is not
 * really a parameter — the "choice" it offers is never exercised. Inline the
 * value and fold any branching on it.
 */
export const constantArgument: CrossFileRule = {
  id: "constant-argument",
  severity: "warning",
  message: "Parameter receives the same literal at every call site; inline the value",
  requires: ["functions", "functionSymbols", "callSites", "callSiteSymbols"],

  analyze(project: ProjectIndex): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];

    for (const fn of project.functions.getAll()) {
      const callSites = signatureChangeCallSites(fn, project, 3);
      if (callSites === null) continue;

      for (let i = 0; i < fn.params.length; i++) {
        const param = fn.params[i];
        if (param === undefined) continue;

        const texts = callSites.map((c) => literalArgText(c.node.arguments[i]));
        const first = texts[0];
        if (first === null || first === undefined) continue;
        if (!texts.every((t) => t === first)) continue;

        diagnostics.push({
          ruleId: this.id,
          severity: this.severity,
          message: `Parameter "${param.name}" receives ${first} at all ${callSites.length} call sites; inline the value and remove the parameter`,
          file: fn.file,
          line: fn.line,
          column: 1,
        });
      }
    }

    return diagnostics;
  },
};

/** Source text of a value-stable literal argument, or null. */
function literalArgText(arg: ts.Expression | undefined): string | null {
  if (arg === undefined) return null;
  if (ts.isStringLiteral(arg) || ts.isNoSubstitutionTemplateLiteral(arg)) return arg.getText();
  if (ts.isNumericLiteral(arg)) return arg.getText();
  if (
    ts.isPrefixUnaryExpression(arg) &&
    arg.operator === ts.SyntaxKind.MinusToken &&
    ts.isNumericLiteral(arg.operand)
  ) {
    return arg.getText();
  }
  if (
    arg.kind === ts.SyntaxKind.TrueKeyword ||
    arg.kind === ts.SyntaxKind.FalseKeyword ||
    arg.kind === ts.SyntaxKind.NullKeyword
  ) {
    return arg.getText();
  }
  return null;
}
