import { label, width } from "./callee";

declare const maybeRing: number[] | null;

label("Alice");
label(`Bob`);

if (maybeRing !== null) {
  width(maybeRing);
}
