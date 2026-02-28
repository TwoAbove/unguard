declare function validate(item: string, domain: string): boolean;

export function processPlaythrough(item: string) {
  return validate(item, "playthrough");
}
