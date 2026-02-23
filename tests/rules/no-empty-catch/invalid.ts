try {
  riskyOperation();
} catch (err) {} // @expect no-empty-catch

try {
  riskyOperation();
} catch {} // @expect no-empty-catch
