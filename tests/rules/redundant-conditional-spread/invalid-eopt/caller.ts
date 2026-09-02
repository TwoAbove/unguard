import { launch, launchStrict, page } from "./options";

export function callWidened(retries: number | undefined): string {
  return launch({
    url: "https://example.test",
    ...(retries === undefined ? {} : { retries }), // @expect redundant-conditional-spread
  });
}

export function callMapped(limit: number | undefined): number {
  return page({
    ...(limit === undefined ? {} : { limit }), // @expect redundant-conditional-spread
  });
}

export function callStrict(retries: number | undefined): string {
  return launchStrict({
    url: "https://example.test",
    ...(retries === undefined ? {} : { retries }),
  });
}
