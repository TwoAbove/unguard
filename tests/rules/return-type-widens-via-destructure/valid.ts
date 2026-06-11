// Tuple destructure — the element is guaranteed by the tuple type, no widening.
function ok_tuple(): string {
  const tuple: [string, number] = ["a", 1];
  const [first] = tuple;
  return first;
}

// Array destructure but the return type explicitly includes undefined — honest.
function ok_honest_return(): string | undefined {
  const arr: string[] = [];
  const [first] = arr;
  return first;
}

// Array destructure followed by a null-check guard before return — narrowed.
function ok_guarded(): string {
  const arr: string[] = [];
  const [first] = arr;
  if (first === undefined) throw new Error("empty");
  return first;
}

// Inverted guard is also proof when the nullish branch terminates.
function ok_guarded_else(): string {
  const arr: string[] = [];
  const [first] = arr;
  if (first !== undefined) {
    console.info(first);
  } else {
    throw new Error("empty");
  }
  return first;
}

// Returned variable is reassigned to a non-array source — not the smell.
declare function makeString(): string;
function ok_reassigned(): string {
  const arr: string[] = [];
  let [first] = arr;
  first = makeString();
  return first;
}

// Returns a tuple element produced by .returning() ish API but with explicit tuple typing
declare function fixedShape(): readonly [string, number];
function ok_fixed_tuple_api(): string {
  const [first] = fixedShape();
  return first;
}
