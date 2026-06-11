interface Config {
  retries: number;
  label: string;
}

declare const config: Config;

const { retries = 3 } = config; // @expect redundant-destructure-default
const { label: name = "anon" } = config; // @expect redundant-destructure-default

function run({ retries = 5 }: Config): number { // @expect redundant-destructure-default
  return retries;
}

export { retries, name, run };
