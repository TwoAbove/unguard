// Silent catch — no logging, no throw
try {
  riskyOperation();
} catch (err) { // @expect no-catch-return
  return null;
}

// Silent catch with computation but no logging
try {
  riskyOperation();
} catch (err) { // @expect no-catch-return
  const fallback = computeFallback();
  return fallback;
}

declare function riskyOperation(): void;
declare function computeFallback(): unknown;
