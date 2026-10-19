let balance = 0;

export function adjust(amount: number): number { // @expect return-value-never-used
  balance += amount;
  return balance;
}

export async function restore(amount: number): Promise<number> { // @expect return-value-never-used
  balance = amount;
  return balance;
}
