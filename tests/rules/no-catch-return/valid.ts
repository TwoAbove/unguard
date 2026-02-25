// Catch that rethrows
try {
  riskyOperation();
} catch (err) {
  throw err;
}

// Catch with both return and throw — allowed because throw path exists
try {
  riskyOperation();
} catch (err) {
  if (err instanceof TypeError) {
    throw err;
  }
  return null;
}

// Catch that logs only (no return)
try {
  riskyOperation();
} catch (err) {
  console.error(err);
}

// Catch with return AND logging — error is recorded
try {
  riskyOperation();
} catch (err) {
  console.error(err);
  return { error: true };
}

// Catch with logger.warn and return
try {
  riskyOperation();
} catch (err) {
  logger.warn("Operation failed", err);
  return null;
}

// Empty catch (different rule)
try {
  riskyOperation();
} catch {}

// Return inside nested function — not the catch itself
try {
  riskyOperation();
} catch (err) {
  const cleanup = () => {
    return "done";
  };
  cleanup();
  throw err;
}

declare function riskyOperation(): void;
declare const logger: { warn(...args: unknown[]): void };
