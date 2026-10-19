import { callerRule, collectFunctionCallerFacts, mergeCallerFacts, type FunctionCallerFacts } from "./callers.ts";

export const optionalArgAlwaysUsed = callerRule({
  id: "optional-arg-always-used",
  message: "Optional parameter is always provided at every call site; make it required",
  collect: collectFunctionCallerFacts,

  *judge(factsList: FunctionCallerFacts[]) {
    for (const { candidate: fn, evidence } of mergeCallerFacts(factsList)) {
      if (evidence.sites.size < 2 || evidence.hasSpread) continue;
      for (const [i, param] of fn.params.entries()) {
        if (!param.optional && !param.hasDefault) continue;
        if (!evidence.observations.every((call) => call.args.length > i)) continue;
        yield {
          site: fn.site,
          message: `Optional parameter "${param.name}" is always provided at all ${evidence.sites.size} call sites; make it required`,
        };
      }
    }
  },
});
