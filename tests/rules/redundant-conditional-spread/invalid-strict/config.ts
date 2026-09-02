export interface RequestConfig {
  url: string;
  retries?: number;
}

export function send(config: RequestConfig): string {
  if (config.retries === undefined) return config.url;
  return `${config.url}#${config.retries}`;
}

/** Not `Object.keys` — a local function that happens to share the name. */
export function keys(config: RequestConfig): number {
  return config.url.length;
}
