export function greet(name: string, greeting?: string) {
  return `${greeting ?? "Hello"}, ${name}`;
}
