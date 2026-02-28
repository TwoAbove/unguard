import { fetchUser } from "./impl.ts";

export function getUser(id: string) { // @expect trivial-wrapper
  return fetchUser(id);
}
