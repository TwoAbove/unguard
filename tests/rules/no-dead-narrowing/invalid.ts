declare const user: { id: string };
if (user) { // @expect no-dead-narrowing
  user.id;
}

declare const list: number[];
const pick = list ? 1 : 2; // @expect no-dead-narrowing

declare const callback: () => void;
if (!callback) { // @expect no-dead-narrowing
  throw new Error("no callback");
}

declare const tag: "ready";
while (tag) { // @expect no-dead-narrowing
  break;
}

declare const str: string;
if (typeof str === "number") { // @expect no-dead-narrowing
  str;
}
if (typeof str === "string") { // @expect no-dead-narrowing
  str;
}

declare const mixed: string | number;
if (typeof mixed === "boolean") { // @expect no-dead-narrowing
  mixed;
}

class Animal {}
class Dog extends Animal {}
declare const dog: Dog;
if (dog instanceof Animal) { // @expect no-dead-narrowing
  dog;
}

declare function isText(value: unknown): value is string;
declare const text: string;
if (isText(text)) { // @expect no-dead-narrowing
  text;
}

declare const items: number[] | string[];
if (Array.isArray(items)) { // @expect no-dead-narrowing
  items;
}

export { pick };
