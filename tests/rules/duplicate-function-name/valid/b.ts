export function farewell(name: string) {
  return `Bye, ${name}`;
}

// Same name as in a.ts but not exported — no collision
function lineAt(source: string, offset: number) {
  return 2;
}
