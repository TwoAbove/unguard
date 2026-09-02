export interface RequestConfig {
  url: string;
  retries?: number;
}

export function split(retries: number | undefined): number {
  const config: RequestConfig = {
    url: "https://example.test",
    ...(retries === undefined ? {} : { retries }),
  };
  const { url, ...rest } = config;
  return url.length + Object.keys(rest).length;
}
