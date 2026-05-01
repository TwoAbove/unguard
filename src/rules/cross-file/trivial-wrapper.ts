import * as ts from "typescript";
import type { CrossFileRule, Diagnostic, ProjectIndex } from "../types.ts";
import type { FunctionEntry } from "../../collect/function-registry.ts";

interface TrivialCallTarget {
  calleeName: string;
}

function getFunctionBody(node: ts.Node): ts.Block | ts.Expression | undefined {
  if (ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node)) {
    return node.body;
  }
  if (ts.isArrowFunction(node)) {
    return node.body;
  }
  if (ts.isMethodDeclaration(node)) {
    return node.body;
  }
  return undefined;
}

function getCalleeName(expr: ts.Expression): string | undefined {
  if (ts.isIdentifier(expr)) return expr.text;
  if (ts.isPropertyAccessExpression(expr)) return expr.name.text;
  return undefined;
}

function getTrivialCallTarget(fn: FunctionEntry): TrivialCallTarget | null {
  const body = getFunctionBody(fn.node);
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

  const calleeName = getCalleeName(callExpr.expression);
  if (!calleeName) return null;

  // All arguments must be plain identifiers matching the function's own param names
  const paramNames = fn.params.map((p) => p.name);
  const args = callExpr.arguments;

  // Args must be a subset of params (in order or not), but every arg must be a plain param reference
  for (const arg of args) {
    if (!ts.isIdentifier(arg)) return null;
    if (!paramNames.includes(arg.text)) return null;
  }

  return { calleeName };
}

export const trivialWrapper: CrossFileRule = {
  id: "trivial-wrapper",
  severity: "info",
  message:
    "Function is a trivial wrapper that delegates without transformation; consider using the target directly",
  requires: ["functions"],

  analyze(project: ProjectIndex): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    const knownFunctions = new Set(
      project.functions.getAll().map((f) => f.name),
    );

    for (const fn of project.functions.getAll()) {
      const target = getTrivialCallTarget(fn);
      if (!target) continue;
      // Don't flag if the callee isn't a known project function
      if (!knownFunctions.has(target.calleeName)) continue;
      // Don't flag if wrapper and target have the same name (re-export pattern)
      if (fn.name === target.calleeName) continue;

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
