declare const isReady: boolean;
declare const value: string;

// Single negation — not double
const x = !isReady;

// Boolean() call — explicit coercion
const y = Boolean(value);

// Bitwise flag check — !! on & is the standard idiom
declare const flags: number;
const FLAG_A = 1;
const FLAG_B = 2;
const hasA = !!(flags & FLAG_A);
const hasB = !!(flags & FLAG_B);
const hasBoth = !!(flags & (FLAG_A | FLAG_B));
