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
