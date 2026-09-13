interface Handle {
  readonly name: string;
  readonly attempts: number;
  readonly label?: string;
}

export function annotated(): Handle {
  return { name: "annotated", attempts: 0 };
}

export function inferredOne() {
  return { name: "one", attempts: 1 };
}
