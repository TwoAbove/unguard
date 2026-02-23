function f(x: string = "default"): string {
  return x;
}

function g(x: string): string {
  const y = x ?? "fallback";
  return y;
}
