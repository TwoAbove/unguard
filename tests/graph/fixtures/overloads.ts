export function choose<T extends string>(value: T): T;
export function choose(value: number): number;
export function choose(value: string | number): string | number {
  return value;
}

export const chosen = choose("first");
