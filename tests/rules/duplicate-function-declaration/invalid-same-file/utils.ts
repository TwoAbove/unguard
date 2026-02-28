function add(a: number, b: number) {
  const result = a + b;
  console.log(result);
  return result;
}

function sum(a: number, b: number) { // @expect duplicate-function-declaration
  const result = a + b;
  console.log(result);
  return result;
}
