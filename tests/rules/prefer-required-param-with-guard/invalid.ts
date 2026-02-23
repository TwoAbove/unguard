function f(x?: string) {
  if (!x) return; // @expect prefer-required-param-with-guard
  doWork(x);
}

function g(x?: string) {
  if (x === undefined) throw new Error("x required"); // @expect prefer-required-param-with-guard
  doWork(x);
}
