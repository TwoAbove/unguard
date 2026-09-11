import type { CallFact, FunctionFact, Graph } from "../../graph/types.ts";

/**
 * Calls that license a signature change: enough of them to be a signal, none
 * with spread arguments, and the function owns its signature.
 */
export function signatureChangeCallers(
  graph: Graph,
  fn: FunctionFact,
  minSites: number,
): readonly CallFact[] | null {
  if (fn.implementsInterface || fn.params.some((param) => param.isRest)) return null;
  const callers = graph.callers(fn.id);
  if (callers.length < minSites || callers.some((call) => call.args.some((arg) => arg.kind === "spread"))) {
    return null;
  }
  return callers;
}
