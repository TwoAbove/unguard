// Type-safe alternatives
const x: string = getValue();
const y = arr[0] ?? "default";

// Guarded: if-check before assertion
function afterIfCheck(items: (string | null)[]) {
  const filtered = items.filter((x) => x !== null);
  return filtered[0]!;
}

// Guarded: if-statement narrows
function afterIf(val: string | undefined) {
  if (val) {
    return val!;
  }
  return "default";
}

// Guarded: && narrows
function afterAnd(val: string | undefined) {
  const result = val && val!.toUpperCase();
  return result;
}

// Guarded: ternary narrows
function afterTernary(val: string | null) {
  return val ? val!.trim() : "default";
}

// split()[n]! — always safe
function firstPart(s: string) {
  return s.split("/")[0]!;
}

declare function getValue(): string;
declare const arr: string[];
