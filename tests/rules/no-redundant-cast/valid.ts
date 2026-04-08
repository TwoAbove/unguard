declare const maybe: string | null;
const narrowed = maybe as string;

declare const broad: unknown;
const typed = broad as string;

declare const union: string | number;
const picked = union as string;

const tuple = [1, 2, 3] as const;

type UserId = string & { __brand: "UserId" };
declare const id: string;
const branded = id as UserId;

declare const response: { json(): Promise<any> };
type Invoice = { id: string };
const data = (await response.json()) as Invoice;
