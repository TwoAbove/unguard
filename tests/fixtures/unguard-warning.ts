declare const value: string | null;

// @unguard no-nullish-coalescing intentional fallback in this adapter
const result = value ?? "default";
