// Function declaration with inline object type
function update(params: { id: string; heading: string; content: string }) {} // @expect no-inline-param-type

// Arrow function with inline object type
const move = (coords: { x: number; y: number }) => {}; // @expect no-inline-param-type

// Object property arrow function
const tools = {
  execute: (params: { id: string; heading: string }) => {}, // @expect no-inline-param-type
};

// Destructured with inline object type
function destruct({ id, heading }: { id: string; heading: string }) {} // @expect no-inline-param-type

// Method declaration
class Foo {
  bar(opts: { verbose: boolean; timeout: number }) {} // @expect no-inline-param-type
}
