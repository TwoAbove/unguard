export interface RequestConfig {
  url: string;
  retries?: number;
}

export function send(config: RequestConfig): string {
  if (config.retries === undefined) return config.url;
  return `${config.url}#${config.retries}`;
}
