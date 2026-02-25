declare const cond: boolean;
declare const a: string;
declare const b: string;

// Normal ternary — no null comparison
const x = cond ? a : b;
const y = a === "" ? "zero" : "other";
