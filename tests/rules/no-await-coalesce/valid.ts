declare const opts: { limit?: number; baseUrl?: string };

// OK: structural property optional, no call in chain
function ok_property_default(): number {
  return opts.limit ?? 10;
}

// OK: parameter default — author of `q?: string` chose absent-as-default
function ok_param_default(q: string | undefined): string {
  return q ?? "";
}

// OK: optional callback invocation — nullability from the structural optional, not the call
function ok_optional_callback_default(handlers: { fallbackCount?: () => Promise<number> }): Promise<number> {
  return handlers.fallbackCount?.() ?? Promise.resolve(0);
}

// OK: call returns non-nullable; ?? itself is dead code (caught by no-nullish-coalescing)
declare function getCount(): number;
function ok_non_nullable_call() {
  return getCount();
}

// OK: identifier (no call in chain)
declare const maybeStr: string | null;
function ok_plain_identifier(): string {
  return maybeStr ?? "default";
}
