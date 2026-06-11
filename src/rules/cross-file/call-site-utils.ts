import * as ts from "typescript";
import type { CallSite } from "../../collect/index.ts";
import type { FunctionEntry, ParamInfo } from "../../collect/function-registry.ts";
import type { ProjectIndex } from "../types.ts";

/**
 * Call sites that license a signature change: symbol-matched, enough of them
 * to be a signal, none with spread arguments (arity unknowable), and the
 * function owns its signature (not an interface implementation, no rest
 * parameter). Returns null when any precondition fails.
 */
export function signatureChangeCallSites(
  fn: FunctionEntry,
  project: ProjectIndex,
  minSites: number,
): CallSite[] | null {
  if (fn.symbol === undefined) return null;
  if (fn.implementsInterface) return null;
  if (hasRestParam(fn.node)) return null;
  const callSites = project.callSites.filter((c) => c.symbol === fn.symbol);
  if (callSites.length < minSites) return null;
  if (callSites.some((c) => c.node.arguments.some(ts.isSpreadElement))) return null;
  return callSites;
}

/** Optional/defaulted parameters with their positional index. */
export function optionalParams(fn: FunctionEntry): Array<{ index: number; param: ParamInfo }> {
  const result: Array<{ index: number; param: ParamInfo }> = [];
  for (let i = 0; i < fn.params.length; i++) {
    const param = fn.params[i];
    if (param === undefined) continue;
    if (!param.optional && !param.hasDefault) continue;
    result.push({ index: i, param });
  }
  return result;
}

function hasRestParam(node: ts.Node): boolean {
  if (!ts.isFunctionLike(node)) return false;
  return node.parameters.some((p) => p.dotDotDotToken !== undefined);
}
