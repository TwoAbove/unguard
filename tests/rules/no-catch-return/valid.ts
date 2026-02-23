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

// Catch that logs
try {
  riskyOperation();
} catch (err) {
  console.error(err);
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
