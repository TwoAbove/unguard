const x = a || "default"; // @expect no-logical-or-fallback
const y = b || 0; // @expect no-logical-or-fallback
const z = c || []; // @expect no-logical-or-fallback
