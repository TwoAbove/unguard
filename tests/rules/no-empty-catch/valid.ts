try {
  riskyOperation();
} catch (err) {
  console.error(err);
}

try {
  riskyOperation();
} catch (err) {
  // intentionally ignored
  void err;
}

try {
  riskyOperation();
} catch {
  // Malformed input — fall through
}

try {
  riskyOperation();
} catch { /* best-effort, ok to fail */ }
