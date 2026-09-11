export function work(): number {
  return 1;
}

export function trulyUnused(): number { // @expect unused-export
  return 42;
}
