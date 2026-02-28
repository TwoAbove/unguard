export function processData(input: string): string {
  const trimmed = input.trim();
  const lower = trimmed.toLowerCase();
  return lower.replace(/\s+/g, "-");
}
