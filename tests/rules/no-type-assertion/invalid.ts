const a = value as unknown as SpecificType; // @expect no-type-assertion
const b = obj as unknown as OtherObj; // @expect no-type-assertion
