declare const maybeUser: { id: string } | null;
if (maybeUser) {
  maybeUser.id;
}

declare const flag: boolean;
if (flag) {
  flag;
}

declare const count: number;
if (count) {
  count;
}

declare const name: string;
if (name) {
  name;
}

declare const mixed: string | number;
if (typeof mixed === "string") {
  mixed;
}

declare const unknownValue: unknown;
if (typeof unknownValue === "string") {
  unknownValue;
}

class Animal {}
class Dog extends Animal {}
declare const animal: Animal;
if (animal instanceof Dog) {
  animal;
}

declare function isText(value: unknown): value is string;
declare const input: unknown;
if (isText(input)) {
  input;
}

declare const maybeItems: unknown;
if (Array.isArray(maybeItems)) {
  maybeItems;
}

// Literal conditions are intentional infinite loops, not narrowing.
while (true) {
  break;
}

// Boolean production outside a condition position is not a narrowing.
declare const obj: { id: string };
const present = Boolean(obj);

// Empty object types are satisfiable by primitives ("" has string's members).
declare const bare: {};
if (bare) {
  bare;
}

enum Level {
  Off = 0,
  On = 1,
}
declare const level: Level;
if (level) {
  level;
}

// Ambient globals exist in some runtimes and not others; the typeof guard is
// an environment probe, not dead code.
function hasProcess(): boolean {
  if (typeof process === "undefined") return false;
  return true;
}

export { present, hasProcess };
