try {
  riskyOperation();
} catch (err) { // @expect no-catch-return
  return null;
}

try {
  riskyOperation();
} catch (err) { // @expect no-catch-return
  console.error(err);
  return { error: true };
}

declare function riskyOperation(): void;
