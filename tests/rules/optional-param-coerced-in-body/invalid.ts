declare function doWork(value: string): void;

// Pattern A: optional reassigned with ?? in body
function bad_defaulted(x?: string): string {
  x = x ?? "default"; // @expect optional-param-coerced-in-body
  return x;
}

// Pattern A variant: ??= compound assignment
function bad_compound_defaulted(x?: string): string {
  x ??= "default"; // @expect optional-param-coerced-in-body
  return x;
}

// Pattern B: optional guarded with !x throw
function bad_guarded_throw(x?: string): void {
  if (!x) throw new Error("x required"); // @expect optional-param-coerced-in-body
  doWork(x);
}

// Pattern B variant: explicit undefined comparison
function bad_guarded_undefined(x?: string): void {
  if (x === undefined) throw new Error("x required"); // @expect optional-param-coerced-in-body
  doWork(x);
}

// Function expression form
const bad_function_expression = function (x?: string): string {
  x = x ?? "default"; // @expect optional-param-coerced-in-body
  return x;
};

// Method form
class Worker {
  run(x?: string): void {
    if (!x) throw new Error("x required"); // @expect optional-param-coerced-in-body
    doWork(x);
  }
}
