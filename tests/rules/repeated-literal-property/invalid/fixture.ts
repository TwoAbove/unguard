// as const hits threshold (3)
const a = { _tag: "Ok" as const, data: 1 }; // @expect repeated-literal-property
const b = { result: "Ok" as const, data: 2 }; // @expect repeated-literal-property
const c = { status: "Ok" as const, data: 3 }; // @expect repeated-literal-property

// Plain literal hits threshold (5)
const d = { type: "text", value: 1 }; // @expect repeated-literal-property
const e = { type: "text", value: 2 }; // @expect repeated-literal-property
const f = { type: "text", value: 3 }; // @expect repeated-literal-property
const g = { type: "text", value: 4 }; // @expect repeated-literal-property
const h = { type: "text", value: 5 }; // @expect repeated-literal-property
