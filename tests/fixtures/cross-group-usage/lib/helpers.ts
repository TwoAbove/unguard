export function sharedHelper(value: number): number {
  return value * 2;
}

export function trulyUnused(label: string): string {
  return `unused:${label}`;
}
