export interface Row {
  id: string;
}

declare const rows: Row[];

export function findRow(id: string): Row | undefined { // @expect nullable-return-always-asserted
  return rows.find((row) => row.id === id);
}

export async function loadRow(id: string): Promise<Row | null> { // @expect nullable-return-always-asserted
  return rows.find((row) => row.id === id) ?? null;
}

export function assertPresent<T>(value: T): asserts value {
  if (!value) throw new Error("missing");
}
