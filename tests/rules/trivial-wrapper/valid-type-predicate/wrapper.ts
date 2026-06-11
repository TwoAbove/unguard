import { isErrorBase } from "./impl.ts";

// Wrapper specializes the predicate target (RangeError, not Error) — this is
// type-level transformation. Not a trivial wrapper.
export function isRangeError(cause: unknown): cause is RangeError {
  return isErrorBase(cause);
}
