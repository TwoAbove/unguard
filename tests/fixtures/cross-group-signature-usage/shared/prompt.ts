export function always(text: string, suffix?: string) {
  return text + (suffix ?? "");
}
always("one", "!");
always("two", "?");

export function never(text: string, suffix?: string) {
  return text + (suffix ?? "");
}
never("one");
never("two");

export function overloaded(value: string): string;
export function overloaded(value: number): string;
export function overloaded(value: string | number): string {
  return String(value);
}
overloaded("one");
overloaded("two");
