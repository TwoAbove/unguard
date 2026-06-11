declare const ready: boolean;
declare const other: boolean;

function direct(): boolean {
  if (ready) return true; // @expect redundant-boolean-branch
  return false;
}

function inverted(): boolean {
  if (ready) return false; // @expect redundant-boolean-branch
  return true;
}

function withElse(): boolean {
  if (ready) { // @expect redundant-boolean-branch
    return true;
  } else {
    return false;
  }
}

const ternary = ready ? true : false; // @expect redundant-boolean-branch
const ternaryCompound = ready && other ? true : false; // @expect redundant-boolean-branch
const ternaryInverted = ready ? false : true; // @expect redundant-boolean-branch

export { direct, inverted, withElse, ternary, ternaryCompound, ternaryInverted };
