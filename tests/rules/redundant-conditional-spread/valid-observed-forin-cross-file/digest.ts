import type { RequestConfig } from "./config";

/** Never called by caller.ts — observation is a property of the type, not the value. */
export function digest(config: RequestConfig): number {
  let total = 0;
  for (const key in config) {
    total += key.length;
  }
  return total;
}
