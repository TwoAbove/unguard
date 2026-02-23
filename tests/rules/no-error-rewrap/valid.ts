// Rethrow original
try {
  riskyOperation();
} catch (err) {
  throw err;
}

// Wrap with cause
try {
  riskyOperation();
} catch (err) {
  throw new Error("wrapped", { cause: err });
}

// Throw new error not referencing catch param
try {
  riskyOperation();
} catch (err) {
  throw new Error("something went wrong");
}

// Throw non-new expression
try {
  riskyOperation();
} catch (err) {
  throw createError(err);
}

declare function riskyOperation(): void;
declare function createError(e: unknown): Error;
