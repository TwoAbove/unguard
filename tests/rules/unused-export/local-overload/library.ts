export function work(value: string): string;
export function work(value: number): number;
export function work(value: string | number): string | number {
  return value;
}

work("used locally");

export function trulyUnused(): number { // @expect unused-export
  return 42;
}
