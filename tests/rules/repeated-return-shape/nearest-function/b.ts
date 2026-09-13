export class Factory {
  outer(): unknown {
    const inferredThree = function () {
      return { value: 3, ready: true };
    };
    return inferredThree;
  }
}
