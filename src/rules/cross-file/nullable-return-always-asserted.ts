import { callerRule, collectVisibleCallerFacts, everyCallSite } from "./callers.ts";

export const nullableReturnAlwaysAsserted = callerRule({
  id: "nullable-return-always-asserted",
  message: "Return value admits null or undefined, but every caller asserts it is present; throw inside the function instead",
  collect: collectVisibleCallerFacts,
  judge: everyCallSite(
    "asserted-present",
    (sites) => `Return value admits null or undefined, but all ${sites} call sites assert it is present; throw inside the function and drop them from its return type`,
  ),
});
