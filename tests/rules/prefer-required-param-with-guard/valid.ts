function f(x: string) {
  if (!x) return;
  doWork(x);
}

function g(x?: string) {
  const y = x ?? "default";
  doWork(y);
}
