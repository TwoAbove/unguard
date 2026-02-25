declare const val: string | null;

const x = val === null ? undefined : val; // @expect no-null-ternary-normalization
const y = val == undefined ? null : val; // @expect no-null-ternary-normalization
