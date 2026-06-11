declare const fromApi: string | null;
declare const fromStore: string | null | undefined;
declare const maybeName: string | undefined;
declare function pick<T>(value: T): T;

// Normalizing null to undefined is a real conversion.
const normalized = fromApi ?? undefined;
const collapsed = fromStore ?? undefined;

// A real fallback value.
const named = maybeName ?? "anonymous";

// Generic operand: undecidable.
function viaGeneric<T>(value: T | undefined): T | undefined {
  return pick(value) ?? undefined;
}

export { normalized, collapsed, named, viaGeneric };
