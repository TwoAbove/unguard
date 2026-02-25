declare const arr: string[];
declare const obj: Record<string, string>;

const x = arr?.[0]; // @expect no-optional-element-access
const y = obj?.["key"]; // @expect no-optional-element-access
