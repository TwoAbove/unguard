declare const str: string;
const a = str as string; // @expect no-redundant-cast

declare const num: number;
const b = num as number; // @expect no-redundant-cast

declare const obj: { id: string };
const c = obj as { id: string }; // @expect no-redundant-cast

declare const arr: string[];
const d = arr as string[]; // @expect no-redundant-cast
