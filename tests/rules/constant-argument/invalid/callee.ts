export function fetchRows(table: string, limit: number) { // @expect constant-argument
  return `${table}:${limit}`;
}

export function render(template: string, strict: boolean) { // @expect constant-argument
  return strict ? template.trim() : template;
}
