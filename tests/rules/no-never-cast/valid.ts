declare const value: string;
const asAny = value as any;
const asUnknown = value as unknown;
const asStr = value as string;

declare const maybe: string | null;
const narrowed = maybe as string;

const tuple = [1, 2, 3] as const;
