// Non-nullish operators
const x = "a" || "b";
const y = "a" && "b";

// Nullable type - ?? is legitimate
declare const maybe: string | null;
const z = maybe ?? "default";

declare const optStr: string | undefined;
const w = optStr ?? "fallback";

// Array destructuring from a possibly-empty array can produce undefined at runtime.
declare const rows: Array<{ id: string }>;
const [row] = rows;
const rowOrNull = row ?? null;
