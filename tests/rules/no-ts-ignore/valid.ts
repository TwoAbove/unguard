// Normal comment
const x = 1;
/* Another normal comment */

// @ts-expect-error -- handled by no-ts-expect-error, not this rule
const y: number = "str";
