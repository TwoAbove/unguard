declare function fetchJson(): Promise<any>;

const data = (await fetchJson()) as { id: string }; // @expect no-unvalidated-cast

declare const raw: string;
const parsed = JSON.parse(raw) as { name: string; age: number }; // @expect no-unvalidated-cast

declare const anyVal: any;
const typed = anyVal as { key: string }; // @expect no-unvalidated-cast

declare const unknownVal: unknown;
const typed2 = unknownVal as { key: string }; // @expect no-unvalidated-cast

const tuple = JSON.parse(raw) as [number, string]; // @expect no-unvalidated-cast

const arr = JSON.parse(raw) as string[]; // @expect no-unvalidated-cast

interface Config { host: string; port: number }
const config = JSON.parse(raw) as Config; // @expect no-unvalidated-cast
