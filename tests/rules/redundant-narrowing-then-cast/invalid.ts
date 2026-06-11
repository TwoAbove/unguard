// `typeof` narrowed the param to `string`; the cast adds nothing.
declare const value: unknown;
function bad_typeof_then_cast(): number {
  if (typeof value === "string") {
    return (value as string).length; // @expect redundant-narrowing-then-cast
  }
  return 0;
}

// `instanceof` narrowed to Date; casting to Date is redundant.
declare const maybeDate: unknown;
function bad_instanceof_then_cast(): number {
  if (maybeDate instanceof Date) {
    return (maybeDate as Date).getTime(); // @expect redundant-narrowing-then-cast
  }
  return -1;
}

// `!=` null narrowed away nullability; casting to the non-nullable form is redundant.
declare const maybeStr: string | null;
function bad_null_check_then_cast(): number {
  if (maybeStr !== null) {
    return (maybeStr as string).length; // @expect redundant-narrowing-then-cast
  }
  return 0;
}

// Truthy narrowing on a property is enough; cast doesn't add info.
declare const obj: { v: string | undefined };
function bad_truthy_then_cast(): string {
  if (obj.v) {
    return (obj.v as string).toUpperCase(); // @expect redundant-narrowing-then-cast
  }
  return "";
}
