import { genericFetch } from "./impl.ts";

// Wrapper introduces its own generic parameter — type-level transformation.
export function fetchTyped<U extends { id: string }>(id: string): U {
  return genericFetch(id);
}
