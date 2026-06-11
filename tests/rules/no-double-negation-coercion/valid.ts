declare const isReady: boolean;
declare const value: string;
declare const maybeUrl: string | null;

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

// !! in a value-producing position (variable initializer that types to boolean)
const explicitBool: boolean = !!maybeUrl;

// !! in an object-property value where the contextual type is boolean
declare function send(payload: { hasUrl: boolean; count: number }): void;
send({ hasUrl: !!maybeUrl, count: 1 });

// !! in a return position for a function whose return type is boolean
function hasValue(): boolean {
  return !!maybeUrl;
}

// !! in a function argument typed as boolean
declare function record(flag: boolean): void;
record(!!maybeUrl);
