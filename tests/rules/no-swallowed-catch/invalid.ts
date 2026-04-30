declare function riskyOperation(): void;
declare function backgroundJob(): Promise<void>;
declare const logger: { error(...args: unknown[]): void; warn(...args: unknown[]): void };

// BAD: empty catch with binding
function bad_empty_with_binding(): void {
  try {
    riskyOperation();
  } catch (err) { // @expect no-swallowed-catch
  }
}

// BAD: empty catch without binding
function bad_empty_no_binding(): void {
  try {
    riskyOperation();
  } catch { // @expect no-swallowed-catch
  }
}

// BAD: comment-only catch
function bad_comment_only(): void {
  try {
    riskyOperation();
  } catch (err) { // @expect no-swallowed-catch
    // intentionally swallowed — but the error is dropped
  }
}

// BAD: log-only — error is logged but not propagated
function bad_log_only(): void {
  try {
    riskyOperation();
  } catch (err) { // @expect no-swallowed-catch
    logger.error("upsert failed", err);
  }
}

// BAD: log and return literal default — error reference doesn't reach the return
function bad_log_and_default(): readonly string[] {
  try {
    return ["a", "b"];
  } catch (err) { // @expect no-swallowed-catch
    logger.warn("listItems failed", err);
    return [];
  }
}

// BAD: return null with no reference to err
function bad_return_null(): null {
  try {
    riskyOperation();
    return null;
  } catch (err) { // @expect no-swallowed-catch
    return null;
  }
}

// BAD: .catch handler returns null
function bad_promise_catch_null(): Promise<unknown> {
  return backgroundJob().catch(() => null); // @expect no-swallowed-catch
}

// BAD: .catch handler binds err but returns null
function bad_promise_catch_log_null(): Promise<unknown> {
  return backgroundJob().catch((err) => { // @expect no-swallowed-catch
    logger.warn("background", err);
    return null;
  });
}

// BAD: .catch handler returns undefined (expression form)
function bad_promise_catch_undefined(): Promise<unknown> {
  return backgroundJob().catch((_err) => undefined); // @expect no-swallowed-catch
}
