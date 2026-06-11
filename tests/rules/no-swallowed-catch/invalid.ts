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

// BAD: return null with no reference to err
function bad_return_null(): null {
  try {
    riskyOperation();
    return null;
  } catch (err) { // @expect no-swallowed-catch
    return null;
  }
}

// BAD: unreachable handoff after a terminal return does not surface the error
function bad_unreachable_log_after_return(): null {
  try {
    riskyOperation();
    return null;
  } catch (err) { // @expect no-swallowed-catch
    return null;
    logger.error("unreachable", err);
  }
}

// BAD: .catch handler returns null
function bad_promise_catch_null(): Promise<unknown> {
  return backgroundJob().catch(() => null); // @expect no-swallowed-catch
}

// BAD: .catch handler returns undefined (expression form)
function bad_promise_catch_undefined(): Promise<unknown> {
  return backgroundJob().catch((_err) => undefined); // @expect no-swallowed-catch
}
