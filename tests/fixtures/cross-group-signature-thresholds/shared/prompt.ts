export function always(draft?: string) {
  return draft ?? "empty";
}
always("one");

export function never(draft?: string) {
  return draft ?? "empty";
}
never();

export function providedOnce(draft?: string) {
  return draft ?? "empty";
}
providedOnce("one");

export function omittedOnce(draft?: string) {
  return draft ?? "empty";
}
omittedOnce();
