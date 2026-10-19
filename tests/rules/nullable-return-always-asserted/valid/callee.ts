export interface Row {
  id: string;
}

declare const rows: Row[];

export function sometimesSkipped(id: string): Row | undefined {
  return rows.find((row) => row.id === id);
}

export function defaulted(id: string): Row | undefined {
  return rows.find((row) => row.id === id);
}

export function checkedLater(id: string): Row | undefined {
  return rows.find((row) => row.id === id);
}

export function onlyOneCaller(id: string): Row | undefined {
  return rows.find((row) => row.id === id);
}

export function passedAsValue(id: string): Row | undefined {
  return rows.find((row) => row.id === id);
}
