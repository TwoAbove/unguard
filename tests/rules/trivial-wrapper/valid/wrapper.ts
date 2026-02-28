import { fetchUser } from "./impl.ts";

export function getUser(id: string) {
  return fetchUser(id.toLowerCase());
}
