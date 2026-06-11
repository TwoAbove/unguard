declare function doWork(value: string): void;

// Required param, no body coercion needed
function ok_required(x: string): string {
  return x;
}

// Optional param with a declaration default — the contract is honest
function ok_param_default(x: string = "default"): string {
  return x;
}

// Required param, body uses an unrelated default for some local
function ok_local_default(x: string): string {
  const y = x.toUpperCase() ?? "fallback";
  return y;
}

// Optional param, body uses it correctly without coercion
function ok_optional_unused_coercion(x?: string): string | undefined {
  doWork(x ?? "");
  return x;
}

// Guard on a *non-optional* param — possibly legitimate runtime check from JS callers,
// not the smell this rule targets (which is the contract lie of an optional that's actually required)
function ok_guard_on_required(x: string): void {
  if (!x) throw new Error("x required");
  doWork(x);
}

// Optional no-op is an honest optional contract: no value means no work.
function ok_optional_noop_return(x?: string): void {
  if (!x) return;
  doWork(x);
}
