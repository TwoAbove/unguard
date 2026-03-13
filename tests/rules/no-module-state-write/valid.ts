const cache = new Map<string, string>();
let count = 0;

count += 1;

export function rememberParam(cache: Map<string, string>, value: string): void {
  cache.set(value, value);
}

export function mutateLocalOnly(): number {
  let localCount = 0;
  localCount += 1;
  return localCount;
}

export function mutateClosure(): () => void {
  let attempts = 0;
  return () => {
    attempts += 1;
  };
}

export function readModuleState(key: string): string | undefined {
  return cache.get(key);
}

export function mutateParamObject(state: { ready: boolean }): void {
  state.ready = true;
}
