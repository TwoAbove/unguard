declare const maybeName: string | undefined;
declare const maybeCount: number | undefined;

const name = maybeName ?? undefined; // @expect no-coalesce-undefined
const count = maybeCount ?? void 0; // @expect no-coalesce-undefined

export { name, count };
