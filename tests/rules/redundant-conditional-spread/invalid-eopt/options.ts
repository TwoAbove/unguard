export interface WidenedOptions {
  url: string;
  retries?: number | undefined;
}

export interface StrictOptions {
  url: string;
  retries?: number;
}

export type MappedOptions = {
  [K in "limit"]?: number | undefined;
};

export function launch(options: WidenedOptions): string {
  if (options.retries === undefined) return options.url;
  return `${options.url}#${options.retries}`;
}

export function launchStrict(options: StrictOptions): string {
  if (options.retries === undefined) return options.url;
  return `${options.url}#${options.retries}`;
}

export function page(options: MappedOptions): number {
  if (options.limit === undefined) return 0;
  return options.limit;
}
