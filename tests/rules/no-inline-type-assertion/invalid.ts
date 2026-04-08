const output = (chunk as { output?: { _tag?: string } }).output; // @expect no-inline-type-assertion
const wrapped = <{ value: string }>source; // @expect no-inline-type-assertion

declare const items: unknown[];
const typed = items as Array<{ id: string }>; // @expect no-inline-type-assertion
const typed2 = items as { id: string }[]; // @expect no-inline-type-assertion
declare const map: unknown;
const typed3 = map as Map<string, { id: string }>; // @expect no-inline-type-assertion
const typed4 = items as readonly { id: string }[]; // @expect no-inline-type-assertion
