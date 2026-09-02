export interface RequestConfig {
  url: string;
  retries?: number;
}

export function describeConfig(config: RequestConfig): string {
  if ("retries" in config) return "explicit";
  return "default";
}
