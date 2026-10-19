import { callerRule, collectFunctionCallerFacts, mergeCallerFacts, type FunctionCallerFacts } from "./callers.ts";

/**
 * A parameter that receives the identical literal at every call site is not
 * really a parameter — the "choice" it offers is never exercised. Inline the
 * value and fold any branching on it.
 */
export const constantArgument = callerRule({
  id: "constant-argument",
  message: "Parameter receives the same literal at every call site; inline the value",
  collect: collectFunctionCallerFacts,

  *judge(factsList: FunctionCallerFacts[]) {
    for (const { candidate, evidence } of mergeCallerFacts(factsList)) {
      if (evidence.sites.size < 3 || evidence.hasSpread) continue;
      for (const [i, { name }] of candidate.params.entries()) {
        const first = evidence.observations[0]?.args[i];
        if (first?.kind !== "literal") continue;
        const firstText = first.text;
        if (!evidence.observations.every((call) => {
          const arg = call.args[i];
          return arg?.kind === "literal" && arg.text === firstText;
        })) {
          continue;
        }
        yield {
          site: candidate.site,
          message: `Parameter "${name}" receives ${firstText} at all ${evidence.sites.size} call sites; inline the value and remove the parameter`,
        };
      }
    }
  },
});
