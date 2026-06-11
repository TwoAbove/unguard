import * as ts from "typescript";
import type { CrossFileRule, Diagnostic, ProjectIndex } from "../types.ts";
import type { FunctionEntry } from "../../collect/function-registry.ts";
import { asSignatureLike, type SignatureLike } from "../../typecheck/utils.ts";

interface TrivialCallTarget {
  calleeName: string;
  callExpr: ts.CallExpression;
}

function getCalleeName(expr: ts.Expression): string | undefined {
  if (ts.isIdentifier(expr)) return expr.text;
  if (ts.isPropertyAccessExpression(expr)) return expr.name.text;
  return undefined;
}

/**
 * Structural fences that disqualify a wrapper from being "trivial" regardless
 * of body shape. Each represents a type/contract transformation that's lost
 * if a caller switches to the wrappee directly.
 */
function hasTypeLevelTransformation(fn: SignatureLike): boolean {
  // Wrapper specializes a type predicate (e.g. `x is RangeError` vs `x is Error`).
  if (fn.type !== undefined && ts.isTypePredicateNode(fn.type)) return true;
  // Wrapper introduces its own generic parameters — the type contract differs.
  return fn.typeParameters !== undefined && fn.typeParameters.length > 0;
}

function getTrivialCallTarget(fn: FunctionEntry): TrivialCallTarget | null {
  const signature = asSignatureLike(fn.node);
  if (signature === null) return null;
  if (hasTypeLevelTransformation(signature)) return null;

  const body = signature.body;
  if (!body) return null;

  let callExpr: ts.CallExpression | undefined;

  if (ts.isBlock(body)) {
    // Block body: exactly one statement that is `return callee(args)`
    if (body.statements.length !== 1) return null;
    const stmt = body.statements[0];
    if (!stmt || !ts.isReturnStatement(stmt) || !stmt.expression) return null;
    if (!ts.isCallExpression(stmt.expression)) return null;
    callExpr = stmt.expression;
  } else {
    // Expression body arrow: `=> callee(args)`
    if (!ts.isCallExpression(body)) return null;
    callExpr = body;
  }

  // If the call carries explicit type arguments, the wrapper is specializing the
  // wrappee's generics at the call site — type-level transformation.
  if (callExpr.typeArguments !== undefined && callExpr.typeArguments.length > 0) return null;

  const calleeName = getCalleeName(callExpr.expression);
  if (!calleeName) return null;

  // Arguments must be plain identifiers matching the wrapper's param list IN ORDER
  // (no reordering — that's a semantic transformation) and pass every param
  // position (no skipping — wrapper.params.length === call.arguments.length).
  const paramNames = fn.params.map((p) => p.name);
  const args = callExpr.arguments;
  if (args.length !== paramNames.length) return null;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === undefined || !ts.isIdentifier(arg)) return null;
    if (arg.text !== paramNames[i]) return null;
  }

  return { calleeName, callExpr };
}

export const trivialWrapper: CrossFileRule = {
  id: "trivial-wrapper",
  severity: "warning",
  message:
    "Function is a trivial wrapper that delegates without transformation; consider using the target directly",
  requires: ["functions", "functionSymbols", "callSites", "callSiteSymbols"],

  analyze(project: ProjectIndex): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    const projectFnSymbols = new Set<ts.Symbol>();
    for (const f of project.functions.getAll()) {
      if (f.symbol !== undefined) projectFnSymbols.add(f.symbol);
    }
    const callSiteSymbols = new Map<ts.CallExpression, ts.Symbol>();
    for (const site of project.callSites) {
      if (site.symbol !== undefined) callSiteSymbols.set(site.node, site.symbol);
    }

    for (const fn of project.functions.getAll()) {
      const target = getTrivialCallTarget(fn);
      if (!target) continue;
      // The callee must resolve, by symbol identity, to a project function.
      // Name matching would misattribute across files and miss aliased imports.
      const calleeSymbol = callSiteSymbols.get(target.callExpr);
      if (calleeSymbol === undefined) continue;
      if (!projectFnSymbols.has(calleeSymbol)) continue;
      // Self-delegation (recursion / re-export binding) is not a wrapper.
      if (fn.symbol !== undefined && calleeSymbol === fn.symbol) continue;

      diagnostics.push({
        ruleId: this.id,
        severity: this.severity,
        message: `Function "${fn.name}" trivially wraps "${target.calleeName}" without transformation`,
        file: fn.file,
        line: fn.line,
        column: 1,
      });
    }
    return diagnostics;
  },
};
