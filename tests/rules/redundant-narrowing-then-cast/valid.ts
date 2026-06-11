// Cast inside a narrowed branch but to a STRICTLY narrower type that the
// narrowing didn't establish — not redundant.
class FooEvent extends Event {
  fooDetail = 1;
}
declare const evt: Event | null;
function ok_cast_to_subclass(): number {
  if (evt instanceof Event) {
    // Narrowing gave us Event, the cast targets FooEvent (subclass) — real info.
    return (evt as FooEvent).fooDetail;
  }
  return 0;
}

// Cast that escapes outside the narrowed branch — not in scope.
declare const x: unknown;
function ok_cast_outside_narrow(): string {
  if (typeof x === "string") {
    return x.toUpperCase();
  }
  return (x as string).toLowerCase();
}

// No narrowing happens at all; cast lives on its own — not the smell.
declare const y: unknown;
function ok_unconditional_cast(): string {
  return (y as string).toUpperCase();
}
