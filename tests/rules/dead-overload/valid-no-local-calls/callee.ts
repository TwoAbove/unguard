export interface Serializable {
  toJSON(): string;
}

export function serialize<T extends Serializable>(value: T): string;
export function serialize<T>(value: T, serializer: (value: T) => string): string;
export function serialize<T>(
  value: T,
  serializer?: (value: T) => string,
): string {
  return serializer ? serializer(value) : (value as T & Serializable).toJSON();
}
