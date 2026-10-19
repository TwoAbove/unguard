import { assertPresent, findRow, loadRow } from "./callee";

export function first(): string {
  const row = findRow("a");
  if (!row) throw new Error("row a missing");
  return row.id;
}

export function second(): string {
  return findRow("b")!.id;
}

export async function third(): Promise<string> {
  const row = await loadRow("c");
  if (row === null) {
    console.error("row c missing");
    throw new Error("row c missing");
  }
  return row.id;
}

export async function fourth(): Promise<string> {
  const row = await loadRow("d");
  assertPresent(row);
  return row.id;
}
