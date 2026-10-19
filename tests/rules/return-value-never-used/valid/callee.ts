let balance = 0;

export function sometimesRead(amount: number): number {
  balance += amount;
  return balance;
}

export function returnsNothing(amount: number): void {
  balance += amount;
}

export async function resolvesNothing(amount: number): Promise<void> {
  balance = amount;
}

export function onlyOneCaller(amount: number): number {
  balance += amount;
  return balance;
}

export function passedAsValue(amount: number): number {
  balance += amount;
  return balance;
}

export function generic<T>(make: () => T): T {
  return make();
}

declare function register<T>(commands: T): T;

export const registered = register({
  save: (amount: number) => {
    balance += amount;
    return balance;
  },
});
