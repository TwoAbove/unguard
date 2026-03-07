export interface Serializable {
  toJSON(): string;
}

export function serialize<T extends Serializable>(value: T): string;
export function serialize<T>(value: T, serializer: (value: T) => string): string; // @expect dead-overload
export function serialize<T>(
  value: T,
  serializer?: (value: T) => string,
): string {
  return serializer ? serializer(value) : (value as T & Serializable).toJSON();
}

export class Sorter {
  sort<T extends { id: string }>(items: T[]): T[];
  sort<T>(items: T[], getId: (item: T) => string): T[]; // @expect dead-overload
  sort<T>(items: T[], getId?: (item: T) => string): T[] {
    const pickId = getId ?? ((item: T) => (item as T & { id: string }).id);
    return [...items].sort((a, b) => pickId(a).localeCompare(pickId(b)));
  }
}
