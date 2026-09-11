function take(value: number) {
  return value;
}

export function run(undefined: number) {
  take(undefined);
  take(undefined);
  take(undefined);
}

run(1);
run(2);
run(3);
