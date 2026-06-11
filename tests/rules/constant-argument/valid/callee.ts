export function fetchRows(table: string, limit: number) {
  return `${table}:${limit}`;
}

export function twice(table: string, limit: number) {
  return `${table}:${limit}`;
}

export function fromVariable(table: string, limit: number) {
  return `${table}:${limit}`;
}
