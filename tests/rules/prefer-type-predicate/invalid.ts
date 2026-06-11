// Classic case: unknown -> boolean with typeof narrowing — should be `value is string`
function bad_typeof_predicate(value: unknown): boolean { // @expect prefer-type-predicate
  return typeof value === "string";
}

// instanceof narrowing — should be `error is Error`
function bad_instanceof_predicate(error: unknown): boolean { // @expect prefer-type-predicate
  return error instanceof Error;
}

// Truthy property check on object — should be `value is { id: string }`
function bad_in_check(value: unknown): boolean { // @expect prefer-type-predicate
  return typeof value === "object" && value !== null && "id" in value;
}

// Arrow form
const bad_arrow_predicate = (value: unknown): boolean => value instanceof Date; // @expect prefer-type-predicate

// Function expression form
const bad_fnexpr_predicate = function (value: unknown): boolean { // @expect prefer-type-predicate
  return typeof value === "string";
};

// Nested predicate call: proof comes from the callee return type, not its name.
declare function hasId(value: unknown): value is { id: string };
function bad_nested_predicate_call(value: unknown): boolean { // @expect prefer-type-predicate
  return value !== null && hasId(value);
}
