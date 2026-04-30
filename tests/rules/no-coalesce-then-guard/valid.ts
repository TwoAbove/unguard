declare const maybeStr: string | null;
declare const maybeNum: number | null;
declare const maybeArr: readonly string[] | null;

// OK: no guard at all — fallback is consumed directly
export function ok_no_guard() {
  return maybeStr ?? "default";
}

// OK: relational guard, not equality with fallback
export function ok_relational_guard() {
  const n = maybeNum ?? -1;
  if (n > 100) return "big";
  return "small";
}

// OK: guard tests an unrelated literal
export function ok_unrelated_literal_guard() {
  const s = maybeStr ?? "default";
  if (s === "specific") return "match";
  return s;
}

// OK: fallback flows into computation, not equality
export function ok_consumed_in_computation() {
  const s = maybeStr ?? "default";
  return s.toUpperCase();
}

// OK: guard checks a length value the fallback could not produce
export function ok_length_check_against_nonempty_fallback() {
  const arr = maybeArr ?? ["seed"];
  if (arr.length === 0) return "empty";
  return arr[0];
}

// OK: binding is reassigned before the guard, so the dead-?? analysis no longer applies
export function ok_reassigned_before_guard() {
  let s = maybeStr ?? null;
  s = "override";
  if (s === null) return "missing";
  return s;
}
