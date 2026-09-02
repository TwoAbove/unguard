import { keys, send, type RequestConfig } from "./config";

export function call(retries: number | undefined): string {
  const config: RequestConfig = {
    url: "https://example.test",
    ...(retries === undefined ? {} : { retries }), // @expect redundant-conditional-spread
  };
  return send(config) + keys(config);
}

export function reversed(retries: number | undefined): string {
  return send({
    url: "https://example.test",
    ...(retries !== undefined ? { retries } : {}), // @expect redundant-conditional-spread
  });
}

export function semanticCondition(active: boolean): string {
  return send({
    url: "https://example.test",
    ...(active ? { retries: 3 } : {}),
  });
}
