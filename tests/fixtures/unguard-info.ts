declare const value: unknown;

const coerced = !!value; // @unguard no-double-negation-coercion boolean coercion is deliberate here

void coerced;
