export function pinned(draft: string | undefined) {
  return draft ?? "empty";
}
pinned(undefined);

export function tooFew(draft: string | undefined) {
  return draft ?? "empty";
}
tooFew(undefined);
