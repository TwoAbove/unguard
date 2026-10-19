import { callerRule, collectVisibleCallerFacts, everyCallSite } from "./callers.ts";

export const returnValueNeverUsed = callerRule({
  id: "return-value-never-used",
  message: "Return value is discarded at every call site; return nothing, or use it",
  collect: collectVisibleCallerFacts,
  judge: everyCallSite("discarded", (sites) => `Return value is discarded at all ${sites} call sites; return nothing, or use it`),
});
