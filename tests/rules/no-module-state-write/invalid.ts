interface User {
  id: string;
}

const cache = new Map<string, User>();
let nextId = 0;
const state = { ready: false };
const names: string[] = [];

export function remember(user: User): void {
  cache.set(user.id, user); // @expect no-module-state-write
}

export function allocateId(): number {
  nextId += 1; // @expect no-module-state-write
  return nextId;
}

export function markReady(): void {
  state.ready = true; // @expect no-module-state-write
}

export function enqueue(name: string): void {
  names.push(name); // @expect no-module-state-write
}

export function bumpFromNested(): void {
  const run = () => {
    nextId++; // @expect no-module-state-write
  };
  run();
}
