declare const str: string;
declare const num: number;
declare const obj: { val: string };

const x = str ?? "fallback"; // @expect no-nullish-coalescing
const y = obj.val ?? "default"; // @expect no-nullish-coalescing
const z = num ?? 0; // @expect no-nullish-coalescing

declare const tuple: [string];
const [first] = tuple;
const tupleFallback = first ?? "fallback"; // @expect no-nullish-coalescing
