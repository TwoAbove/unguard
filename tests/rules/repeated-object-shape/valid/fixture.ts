// 4 occurrences of same shape (below threshold of 5)
const a = { x: 1, y: 2 };
const b = { x: 3, y: 4 };
const c = { x: 5, y: 6 };
const d = { x: 7, y: 8 };

// Different shapes
const e = { a: 1, b: 2 };
const f = { a: 1, c: 3 };

// Spread — dynamic shape, skipped
const base = { x: 0 };
const g = { ...base, z: 1 };
const h = { ...base, z: 2 };
const i = { ...base, z: 3 };
const j = { ...base, z: 4 };
const k = { ...base, z: 5 };
