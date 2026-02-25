// Non-literal RHS — not a fallback pattern
const a = x || b;
const b2 = x || getDefault();

// Generic identifier LHS — no data-structure signal
const c = name || "Unknown";

// Env vars — empty string means "not configured"
const d = process.env.REDIS_URL || "redis://localhost:6379";

// parseInt wrapping — || prevents NaN
const e = parseInt(query || "12", 10);

// Number wrapping — || catches NaN/0 intentionally
const f = Number(port) || 8080;

// .trim() — empty string after trim is "absent"
const g = input.trim() || "default";

// headers.get — empty string means no header
const h = res.headers.get("content-type") || "application/json";

// URL properties — empty string means not set
const i = url.password || undefined;
const j = url.port || "443";
const k = url.username || undefined;

// || with non-literal RHS
const l = map.get("key") || otherMap.get("key");
