declare function validate(item: string, domain: string): boolean;

export function processPlaythrough(item: string) {
  const normalized = item.trim().toLowerCase();
  if (normalized.length === 0) return false;
  return validate(normalized, "playthrough");
}

export function processWizard(item: string) { // @expect near-duplicate-function
  const normalized = item.trim().toLowerCase();
  if (normalized.length === 0) return false;
  return validate(normalized, "wizard");
}
