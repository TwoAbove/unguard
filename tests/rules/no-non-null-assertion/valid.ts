// Type-safe alternatives
declare function getValue(): string;
declare const arr: string[];
const x: string = getValue();
const y = arr[0] ?? "default";

// Type already non-nullable — ! is redundant noise, not flagged
declare const definiteStr: string;
const z = definiteStr!;

// Guarded: filter then index — result is nullable but pattern is safe
function afterFilter(items: (string | null)[]) {
  const filtered = items.filter((x) => x !== null);
  return filtered[0]!;
}

// split()[n]! — always safe
function firstPart(s: string) {
  return s.split("/")[0]!;
}

// Length-guarded: early return when empty
function afterLengthCheck(stmts: (string | undefined)[]) {
  if (stmts.length === 0) return;
  return stmts[0]!;
}

// Length-guarded: > 0 check
function withPositiveLength(items: (number | undefined)[]) {
  if (items.length > 0) {
    return items[0]!;
  }
}

// Length-guarded: !== 0
function withNonZeroLength(items: (number | undefined)[]) {
  if (items.length !== 0) {
    return items[0]!;
  }
}

// Length-guarded: >= 1
function withMinLength(items: (number | undefined)[]) {
  if (items.length >= 1) {
    return items[0]!;
  }
}

// Length-guarded: exact length check
function withExactLength(items: (string | undefined)[]) {
  if (items.length !== 1) return;
  return items[0]!;
}

// For-loop bounded indexing
function forLoopBounded(items: (string | undefined)[]) {
  for (let i = 0; i < items.length; i++) {
    console.log(items[i]!);
  }
}
