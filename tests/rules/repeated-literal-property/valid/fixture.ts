// as const — 2 scopes (below threshold of 3)
function fn1() { return { _tag: "Ok" as const, data: 1 }; }
function fn2() { return { _tag: "Ok" as const, data: 2 }; }

// Plain literal — 4 scopes (below threshold of 5)
function fn3() { return { type: "text", value: 1 }; }
function fn4() { return { type: "text", value: 2 }; }
function fn5() { return { type: "text", value: 3 }; }
function fn6() { return { type: "text", value: 4 }; }

// Registry pattern — many occurrences but all at module scope (1 scope)
const metadata: Record<string, { category: string }> = {
  "rule-a": { category: "cross-file" },
  "rule-b": { category: "cross-file" },
  "rule-c": { category: "cross-file" },
  "rule-d": { category: "cross-file" },
  "rule-e": { category: "cross-file" },
  "rule-f": { category: "cross-file" },
};

// Not in object literal — should not count
const g = "standalone";
const h = "standalone";
const i = "standalone";
const j = "standalone";
const k = "standalone";
