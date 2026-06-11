declare function getValue(): string | undefined;
declare const arr: (string | undefined)[];

// No local guard — unguarded assertions on nullable types
const x = getValue()!; // @expect no-non-null-assertion
const y = arr[0]!; // @expect no-non-null-assertion

// Inside function, no guard
function noGuard(ctx: { from?: { id: number } }) {
  return ctx.from!.id; // @expect no-non-null-assertion
}

// filter() narrows the element type but NOT the length — index 0 can be absent
function afterFilter(items: (string | null)[]) {
  const filtered = items.filter((x) => x !== null);
  return filtered[0]!; // @expect no-non-null-assertion
}

// split()[n>0]! — only index 0 is guaranteed
function secondPart(s: string) {
  return s.split("/")[1]!; // @expect no-non-null-assertion
}
