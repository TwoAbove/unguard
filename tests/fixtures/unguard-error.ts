declare const value: unknown;

const unsafe = value as any; // @unguard no-any-cast still unsafe

void unsafe;
