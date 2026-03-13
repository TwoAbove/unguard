const cache = new Map<string, string>();

export function remember(value: string): void {
  // @unguard no-module-state-write module cache is intentional in this adapter
  cache.set(value, value);
}
