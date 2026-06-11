import { copy } from "./impl.ts";

// Argument order swapped — semantic transformation.
export function copyReversed(dst: string, src: string): void {
  return copy(src, dst);
}
