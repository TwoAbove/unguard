// as const — 2 occurrences (below threshold of 3)
const a = { _tag: "Ok" as const, data: 1 };
const b = { _tag: "Ok" as const, data: 2 };

// Plain literal — 4 occurrences (below threshold of 5)
const c = { type: "text", value: 1 };
const d = { type: "text", value: 2 };
const e = { type: "text", value: 3 };
const f = { type: "text", value: 4 };

// Not in object literal — should not count
const g = "standalone";
const h = "standalone";
const i = "standalone";
const j = "standalone";
const k = "standalone";
