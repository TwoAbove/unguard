declare const map: Map<string, string>;
declare const arr: string[];
declare const record: Record<string, number>;
declare const obj: { nested?: { value: string } };
declare const store: { getStore(): string | undefined };

// Data-structure lookups — should use ??
const a = map.get("key") || "default"; // @expect no-logical-or-fallback
const b = arr.find((x) => x === "needle") || "none"; // @expect no-logical-or-fallback
const c = record["key"] || 0; // @expect no-logical-or-fallback
const d = arr[0] || "empty"; // @expect no-logical-or-fallback
const e = obj?.nested?.value || "fallback"; // @expect no-logical-or-fallback
const f = store.getStore() || "default"; // @expect no-logical-or-fallback
