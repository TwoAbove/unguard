interface Options {
  retries?: number;
  label: string | undefined;
  exact: number;
}

declare const options: Options;
declare function loadOptions<T>(): T;

// Optional property: the default is live.
const { retries = 3 } = options;

// Type includes undefined: the default is live.
const { label = "anon" } = options;

// No default at all.
const { exact } = options;

// Generic source: undecidable.
function viaGeneric<T extends Options>(input: T): number {
  const { retries: count = 1 } = input;
  return count;
}

// Untyped parameter destructuring is contextually typed; skipped.
declare function each(callback: (item: { value?: number }) => number): void;
each(({ value = 0 }) => value);

export { retries, label, exact, viaGeneric };
