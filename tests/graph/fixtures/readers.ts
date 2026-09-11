export const token = "token";

declare function consume(value: unknown): void;

token();
consume(token);
const spread = [...token];
const keyed = token.length;
const narrowed = typeof token === "string";
type Token = typeof token;
export const bag = { token };

export { keyed, narrowed, spread };
export type { Token };
