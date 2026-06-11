// Array destructure widens the element to `T | undefined`, but the return
// annotation lies — claims `string`.
function bad_array_destructure(): string {
  const arr: string[] = [];
  const [first] = arr;
  return first; // @expect return-type-widens-via-destructure
}

// Drizzle-style .returning() that yields an array; first element is T | undefined.
declare function returningRows(): { id: string }[];
function bad_drizzle_returning(): { id: string } {
  const [row] = returningRows();
  return row; // @expect return-type-widens-via-destructure
}

// Async wrapper around the same shape.
declare function asyncRows(): Promise<{ id: string }[]>;
async function bad_async_destructure(): Promise<{ id: string }> {
  const [row] = await asyncRows();
  return row; // @expect return-type-widens-via-destructure
}

// Later destructure-from-Map.entries-ish iterator that yields `[K, V] | undefined` —
// when the source is array-typed and element index is not proven, widening leaks.
function bad_second_position(): number {
  const arr: number[] = [];
  const [, second] = arr;
  return second; // @expect return-type-widens-via-destructure
}

// A guard after the return is unreachable and must not defuse the widening.
function bad_guard_after_return(): string {
  const arr: string[] = [];
  const [first] = arr;
  return first; // @expect return-type-widens-via-destructure
  if (first === undefined) throw new Error("empty");
}

// A guard inside a nested helper does not narrow the outer return.
function bad_nested_guard_does_not_defuse(): string {
  const arr: string[] = [];
  const [first] = arr;
  function assertFirst(): void {
    if (first === undefined) throw new Error("empty");
  }
  void assertFirst;
  return first; // @expect return-type-widens-via-destructure
}

// A non-terminal guard observes the hole but lets undefined fall through.
function bad_non_terminal_guard(): string {
  const arr: string[] = [];
  const [first] = arr;
  if (first === undefined) {
    console.warn("empty");
  }
  return first; // @expect return-type-widens-via-destructure
}

// A standalone assertion does not change runtime behavior before the return.
function bad_non_null_assertion_only(): string {
  const arr: string[] = [];
  const [first] = arr;
  first!;
  return first; // @expect return-type-widens-via-destructure
}

// A standalone cast does not change runtime behavior before the return.
function bad_cast_only(): string {
  const arr: string[] = [];
  const [first] = arr;
  first as string;
  return first; // @expect return-type-widens-via-destructure
}
