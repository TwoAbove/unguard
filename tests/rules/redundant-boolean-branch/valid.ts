declare const ready: boolean;
declare const text: string;
declare const count: number;
declare const maybe: boolean | undefined;

// Coercion, not restatement: the condition is not a boolean.
function coerceString(): boolean {
  if (text) return true;
  return false;
}
const coerceCount = count ? true : false;
const coerceMaybe = maybe ? true : false;

// Different work per branch — not a restatement.
function differentValues(): number {
  if (ready) return 1;
  return 0;
}

// Same literal both ways is nonsense but not this rule's restatement shape.
const sameBoth = ready ? true : true;

// Extra statements in the branch.
function extraWork(): boolean {
  if (ready) {
    count.toFixed();
    return true;
  }
  return false;
}

// The following statement is not a bare boolean return.
function tailWork(): boolean {
  if (ready) return true;
  count.toFixed();
  return false;
}

declare const other: boolean;

// Inverted compound: the rewrite would synthesize `!(ready && other)`, which
// reads worse than the guard clause it replaces.
function invertedCompound(): boolean {
  if (ready && other) return false;
  return true;
}
const invertedCompoundTernary = ready && other ? false : true;

export { coerceString, coerceCount, coerceMaybe, differentValues, sameBoth, extraWork, tailWork, invertedCompound, invertedCompoundTernary };
