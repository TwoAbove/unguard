export function label(name: string | undefined): string { // @expect nullable-param-never-null
  return name === undefined ? "anonymous" : name.toUpperCase();
}

export function width(ring: number[] | null): number { // @expect nullable-param-never-null
  if (ring === null) return 0;
  return ring.length;
}
