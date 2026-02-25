declare function getValue(): string | undefined;
declare const arr: (string | undefined)[];

// No local guard — unguarded assertions on nullable types
const x = getValue()!; // @expect no-non-null-assertion
const y = arr[0]!; // @expect no-non-null-assertion

// Inside function, no guard
function noGuard(ctx: { from?: { id: number } }) {
  return ctx.from!.id; // @expect no-non-null-assertion
}
