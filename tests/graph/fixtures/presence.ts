export interface PresenceOptions {
  retry?: number;
}

export function observesRetry(options: PresenceOptions): boolean {
  return "retry" in options;
}

export function buildOptions(retry: number | undefined): PresenceOptions {
  return {
    ...(retry === undefined ? {} : { retry }),
  };
}
