declare function readSync(): string;
declare const value: number;
declare const items: string[];

async function awaitedSync(): Promise<string> {
  return await readSync(); // @expect no-useless-await
}

async function awaitedValue(): Promise<number> {
  const doubled = (await value) * 2; // @expect no-useless-await
  return doubled;
}

async function awaitedArray(): Promise<string[]> {
  return await items; // @expect no-useless-await
}

export { awaitedSync, awaitedValue, awaitedArray };
