export interface RequestConfig {
  url: string;
  retries?: number;
}

export function snapshot(retries: number | undefined): string {
  const config: RequestConfig = {
    url: "https://example.test",
    ...(retries === undefined ? {} : { retries }),
  };
  return JSON.stringify(config);
}
