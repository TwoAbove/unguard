interface Result {
  value: number;
  ready: boolean;
  detail?: string;
}

export function annotated(): Result {
  return { value: 0, ready: true };
}

export function outerOne(): unknown {
  function inferredOne() { // @expect repeated-return-shape
    return { value: 1, ready: true };
  }
  return inferredOne;
}

export function outerTwo(): unknown {
  const inferredTwo = () => ({ value: 2, ready: true });
  return inferredTwo;
}
