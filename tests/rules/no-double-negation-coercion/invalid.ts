declare const value: string;
declare const obj: { prop: number };
declare const flag: string | null;

// !! in an `if` test position — the if already coerces to boolean, so !! is noise.
function inIf(): string {
  if (!!value) return "a"; // @expect no-double-negation-coercion
  return "b";
}

// !! in a `while` test position
function inWhile(): void {
  while (!!obj.prop) { // @expect no-double-negation-coercion
    break;
  }
}

// !! in a ternary condition
const ternary = !!value ? "yes" : "no"; // @expect no-double-negation-coercion

// !! inside an `if` test via logical AND — propagates through &&/||
function inAnd(): boolean {
  if (true && !!flag) return true; // @expect no-double-negation-coercion
  return false;
}

// !!!x is just !x; the inner !! is no-op
const triple = !!!value; // @expect no-double-negation-coercion
