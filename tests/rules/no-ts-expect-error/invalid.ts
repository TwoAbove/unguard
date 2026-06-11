// @ts-expect-error // @expect no-ts-expect-error
const x: number = "str";

// @ts-expect-error suppressing a call-arity error // @expect no-ts-expect-error
const y: string = Math.abs(x, x);
