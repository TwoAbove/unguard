interface Store {
  findById(id: string): Promise<{ id: string; content: string } | null>;
  list(): Promise<readonly { id: string }[] | null>;
  countOrNull(): number | null;
}

declare const store: Store;

// BAD: awaited call returns Promise<T | null>; ?? collapses null-as-failure into a stand-in
async function bad_awaited_null_default(id: string) {
  return (await store.findById(id)) ?? null; // @expect no-await-coalesce
}

// BAD: same pattern with empty-array fallback
async function bad_awaited_empty_array_default() {
  return (await store.list()) ?? []; // @expect no-await-coalesce
}

// BAD: synchronous call returning T | null
function bad_sync_call_zero_default() {
  return store.countOrNull() ?? 0; // @expect no-await-coalesce
}

// BAD: awaited result with optional chain — short-circuit and null fuse via ??
async function bad_optional_chain_after_await(id: string) {
  return (await store.findById(id))?.id ?? "unknown"; // @expect no-await-coalesce
}

// BAD: awaited list with element access then ??
async function bad_element_access() {
  return (await store.list())?.[0] ?? { id: "missing" }; // @expect no-await-coalesce
}
