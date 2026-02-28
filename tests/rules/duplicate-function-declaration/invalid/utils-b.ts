function sum(a: number, b: number) { // @expect duplicate-function-declaration
  const result = a + b;
  console.log(result);
  return result;
}
