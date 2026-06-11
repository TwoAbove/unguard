declare function fetchText(): Promise<string>;
declare const thenable: { then(onfulfilled: (value: number) => void): void };
declare const either: string | Promise<string>;

async function awaitedPromise(): Promise<string> {
  return await fetchText();
}

async function awaitedThenable(): Promise<number> {
  return await thenable;
}

async function awaitedUnion(): Promise<string> {
  return await either;
}

async function awaitedGeneric<T>(input: T): Promise<T> {
  return await input;
}

export { awaitedPromise, awaitedThenable, awaitedUnion, awaitedGeneric };
