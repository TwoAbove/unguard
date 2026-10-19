import { checkedLater, defaulted, onlyOneCaller, passedAsValue, sometimesSkipped } from "./callee";

export function skips(): string | undefined {
  const asserted = sometimesSkipped("a");
  if (!asserted) throw new Error("missing");
  const skipped = sometimesSkipped("b");
  if (!skipped) return undefined;
  return asserted.id + skipped.id;
}

export function defaults(): string {
  const row = defaulted("a");
  if (!row) throw new Error("missing");
  return row.id + (defaulted("b") ?? { id: "" }).id;
}

export function later(): string {
  const row = checkedLater("a");
  const label = "row";
  if (!row) throw new Error(`${label} missing`);
  return checkedLater("b")!.id + row.id;
}

export function single(): string {
  return onlyOneCaller("a")!.id;
}

export function asValue(): string {
  const row = passedAsValue("a");
  if (!row) throw new Error("missing");
  return passedAsValue("b")!.id + ["c"].map(passedAsValue).length;
}
