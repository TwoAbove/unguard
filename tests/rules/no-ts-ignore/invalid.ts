// @ts-ignore // @expect no-ts-ignore
const x = 1;
// @ts-expect-error // @expect no-ts-ignore
const y = 2;

const template = `value ${x}`;
// @ts-ignore // @expect no-ts-ignore
const z = template;
