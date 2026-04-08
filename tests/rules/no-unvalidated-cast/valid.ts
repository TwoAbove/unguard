// Branded type constructors — source is string, not any/unknown
type UserId = string & { __brand: "UserId" };
const id = crypto.randomUUID() as UserId;

// String literal union — target is primitive-family
type ConfigKey = "host" | "port" | "debug";
declare const key: string;
const k = key as ConfigKey;

// as const
const tuple = [1, 2, 3] as const;

// Narrowing — source is string, not any
declare const str: string;
const narrowed = str as "hello";

// Cast to primitive
declare const anyVal: any;
const s = anyVal as string;
const n = anyVal as number;
const b = anyVal as boolean;

// Empty array widening
const empty = [] as string[];

// Prior runtime validation narrows the type
declare function isConfig(v: unknown): v is { host: string };
declare const raw: unknown;
if (isConfig(raw)) {
  const c = raw as { host: string };
}
