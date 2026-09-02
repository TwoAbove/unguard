import { send, type RequestConfig } from "./config";

export function call(retries: number | undefined): string {
  const config: RequestConfig = {
    url: "https://example.test",
    ...(retries === undefined ? {} : { retries }),
  };
  return send(config);
}
