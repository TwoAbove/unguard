function f(x?: string) {
  x = x ?? "default"; // @expect prefer-default-param-value
  return x;
}
