export function greet(name: string) {
  return `Hello, ${name}`;
}

// Private helper — same name in another file is fine
function lineAt(source: string, offset: number) {
  return 1;
}
