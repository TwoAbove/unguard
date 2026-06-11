// This group compiles WITHOUT noUncheckedIndexedAccess: index reads erase
// `undefined` from their types, so "always truthy" cannot be proven for any
// value — the guards below are load-bearing despite what the types claim.

declare const rows: Array<{ id: string }>;

// Direct index read: type says { id: string }, runtime may be undefined.
const first = rows[0];
if (first) {
  first.id;
}

// Array destructure: same lie through a binding pattern.
const [head] = rows;
if (head) {
  head.id;
}

// The lie crosses a helper's return type; only suppressing all truthiness
// verdicts in this group covers it.
declare function pickFirst(list: Array<{ id: string }>): { id: string };
const item = pickFirst(rows);
if (item) {
  item.id;
}

export {};
