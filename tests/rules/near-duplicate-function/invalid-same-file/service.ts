declare function validate(item: string, domain: string): boolean;

export function processPlaythrough(item: string) {
  return validate(item, "playthrough");
}

export function processWizard(item: string) { // @expect near-duplicate-function
  return validate(item, "wizard");
}
