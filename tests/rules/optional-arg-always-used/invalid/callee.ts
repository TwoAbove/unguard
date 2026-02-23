export function greet(name: string, greeting?: string) { // @expect optional-arg-always-used
  return `${greeting ?? "Hello"}, ${name}`;
}
