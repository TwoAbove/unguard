export function usedHelper() {
  return 1;
}

export function unusedHelper() { // @expect unused-export
  return 2;
}
