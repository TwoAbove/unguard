try {
  riskyOperation();
} catch (err) {
  throw new Error(err.message); // @expect no-error-rewrap
}

try {
  riskyOperation();
} catch (e) {
  throw new TypeError("failed: " + e.message); // @expect no-error-rewrap
}

declare function riskyOperation(): void;
