declare const partial: { send: () => void };
const mocked = partial as never; // @expect no-never-cast

declare const value: string;
const erased = value as never; // @expect no-never-cast
