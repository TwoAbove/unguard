export function sometimesMissing(name: string | undefined): string {
  return name ?? "anonymous";
}

export function explicitlyMissing(name: string | null): string {
  return name ?? "anonymous";
}

export function passedAsValue(name: string | undefined): string {
  return name ?? "anonymous";
}

export function optionalInstead(name?: string): string {
  return name ?? "anonymous";
}

export function receivesAny(name: string | undefined): string {
  return name ?? "anonymous";
}

export function overloaded(name: string): string;
export function overloaded(name: number): string;
export function overloaded(name: string | number | undefined): string {
  return String(name);
}

export const contextual: (name: string | undefined) => string = (name) => name ?? "anonymous";
