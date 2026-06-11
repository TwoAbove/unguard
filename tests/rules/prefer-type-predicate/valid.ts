// Param is already specific (not unknown/wide union) — predicate would be a tautology
function ok_already_specific(s: string): boolean {
  return s.length > 0;
}

// Param is unknown but the body has no narrowing operation on it — the function
// is a "probably true" predicate, not a type narrowing one
declare const config: { strict: boolean };
function ok_no_narrowing(value: unknown): boolean {
  return config.strict;
}

// Multiple params — not a single-param predicate
function ok_multi_param(a: unknown, b: unknown): boolean {
  return a === b;
}

// Return type is already a type predicate — already correct, no rewrite proposed
function ok_already_predicate(value: unknown): value is string {
  return typeof value === "string";
}

// Return type is not annotated — inference doesn't trigger the rule
function ok_inferred(value: unknown) {
  return typeof value === "string";
}

// Body's return value flows through method calls or non-trivial expressions —
// can't always represent as a predicate (the return shape isn't a structural
// boolean of narrowing checks)
function ok_complex_body(value: unknown): boolean {
  const s = String(value);
  return s.length > 0;
}

// Param is an enum-like literal union — membership test on literals. Refactor
// would name an anonymous subset; not a high-signal change. Skip.
type Mode = "create" | "update" | "delete" | "read";
function ok_enum_membership(mode: Mode): boolean {
  return mode === "create" || mode === "update";
}

// Equality against another runtime value is a comparison predicate, not a type predicate.
declare const currentValue: string | number;
function ok_runtime_equality(value: string | number): boolean {
  return value === currentValue;
}

// A boolean helper call is not proof unless its signature is a type predicate.
declare function acceptsRuntimeValue(value: unknown): boolean;
function ok_boolean_helper_call(value: unknown): boolean {
  return acceptsRuntimeValue(value);
}
