declare const maybeStr: string | null;
declare const maybeStrU: string | undefined;
declare const maybeArr: readonly string[] | null;

// BAD: ?? null then guard against null — partition identical to direct null check
export function bad_null_then_not_null() {
  const s = maybeStr ?? null; // @expect no-coalesce-then-guard
  if (s !== null) return s;
  return "missing";
}

// BAD: ?? null with early-return form
export function bad_null_then_early_return() {
  const s = maybeStr ?? null; // @expect no-coalesce-then-guard
  if (s === null) return "missing";
  return s;
}

// BAD: ?? undefined + undefined check
export function bad_undefined_then_check() {
  const s = maybeStrU ?? undefined; // @expect no-coalesce-then-guard
  if (s === undefined) return "missing";
  return s;
}

// BAD: ?? [] then length-zero check — empty fallback fuses with absence
export function bad_empty_array_then_length_check() {
  const arr = maybeArr ?? []; // @expect no-coalesce-then-guard
  if (arr.length === 0) return "empty";
  return arr[0];
}

// BAD: ?? [] then positive-length check (other side of same partition)
export function bad_empty_array_then_positive_length() {
  const arr = maybeArr ?? []; // @expect no-coalesce-then-guard
  if (arr.length > 0) return arr[0];
  return "empty";
}
