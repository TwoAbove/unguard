const output = (chunk as { output?: { _tag?: string } }).output; // @expect no-inline-type-assertion
const wrapped = <{ value: string }>source; // @expect no-inline-type-assertion
