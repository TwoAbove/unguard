// Direct element access - not flagged
declare const arr: string[];
declare const obj: Record<string, string>;
const x = arr[0];
const y = obj["key"];

// Nullable type - ?. is legitimate
declare const maybeArr: string[] | null;
const z = maybeArr?.[0];

declare const maybeObj: Record<string, string> | undefined;
const w = maybeObj?.["key"];
