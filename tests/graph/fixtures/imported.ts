export default function defaultThing(): string {
  return "default";
}

export function namedThing(): string {
  return "named";
}

export const importedConstant = "constant";
export type ImportedType = { value: string };
