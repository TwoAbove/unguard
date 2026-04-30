declare function riskyOperation(): void;
declare function backgroundJob(): Promise<void>;
declare const logger: { error(...args: unknown[]): void; warn(...args: unknown[]): void };

// OK: bare rethrow propagates the failure
function ok_rethrow(): void {
  try {
    riskyOperation();
  } catch (err) {
    throw err;
  }
}

// OK: log then rethrow — logging is fine, the throw still propagates
function ok_log_then_throw(): void {
  try {
    riskyOperation();
  } catch (err) {
    logger.error("failed", err);
    throw err;
  }
}

// OK: wrap with context, throw new error referencing the original
function ok_wrap_and_throw(): void {
  try {
    riskyOperation();
  } catch (err) {
    throw new Error(`riskyOperation failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

// OK: Result-style return — the returned shape carries the error binding
type Result<T> = { ok: true; value: T } | { ok: false; err: unknown };
function ok_result_shape(): Result<number> {
  try {
    return { ok: true, value: 42 };
  } catch (err) {
    return { ok: false, err };
  }
}

// OK: branched catch — type-narrowed throw on one side, error-carrying return on the other
function ok_branched(): { kind: "wrapped"; cause: unknown } {
  try {
    riskyOperation();
    return { kind: "wrapped", cause: null };
  } catch (err) {
    if (err instanceof TypeError) throw err;
    return { kind: "wrapped", cause: err };
  }
}

// OK: nested function with its own return — outer catch still throws
function ok_nested_helper(): void {
  try {
    riskyOperation();
  } catch (err) {
    const helper = () => "done";
    helper();
    throw err;
  }
}

// OK: .catch handler that rethrows
function ok_catch_rethrow_arrow(): Promise<void> {
  return backgroundJob().catch((err) => {
    throw err;
  });
}

// OK: .catch handler that returns a result-style value referencing the error
function ok_catch_result_shape(): Promise<Result<void>> {
  return backgroundJob().then(() => ({ ok: true as const, value: undefined })).catch((err) => ({
    ok: false as const,
    err,
  }));
}
