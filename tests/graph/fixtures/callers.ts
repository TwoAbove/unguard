export function target(label: string, count: number): string {
  return `${label}:${count}`;
}

export function callTarget(count: number): string {
  target("literal", count);
  const args: [string, number] = ["spread", count];
  return target(...args);
}

export class Constructed {
  constructor(public value: string) {}
}

export const instance = new Constructed("created");
