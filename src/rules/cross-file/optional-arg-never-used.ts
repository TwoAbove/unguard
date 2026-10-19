import { callerRule, collectFunctionCallerFacts, mergeCallerFacts, type FunctionCallerFacts } from "./callers.ts";

/**
 * The mirror of `optional-arg-always-used`: an optional (or defaulted)
 * parameter that no call site ever provides is speculative API surface —
 * remove it and inline its default into the body.
 */
export const optionalArgNeverUsed = callerRule({
  id: "optional-arg-never-used",
  message: "Optional parameter is never provided at any call site; remove it",
  collect: collectFunctionCallerFacts,

  *judge(factsList: FunctionCallerFacts[]) {
    for (const { candidate: fn, evidence } of mergeCallerFacts(factsList)) {
      if (evidence.sites.size < 2 || evidence.hasSpread) continue;
      const neverProvided = fn.params
        .filter((param, i) => (param.optional || param.hasDefault) && evidence.observations.every((call) => call.args.length <= i))
        .map((param) => param.name);
      if (neverProvided.length === 0) continue;

      const names = neverProvided.map((name) => `"${name}"`).join(", ");
      yield {
        site: fn.site,
        message: `Optional parameter${neverProvided.length > 1 ? "s" : ""} ${names} ${neverProvided.length > 1 ? "are" : "is"} never provided at any of the ${evidence.sites.size} call sites; remove ${neverProvided.length > 1 ? "them" : "it"} and inline the default`,
      };
    }
  },
});
