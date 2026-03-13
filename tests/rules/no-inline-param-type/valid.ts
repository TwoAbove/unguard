interface Params {
  id: string;
  heading: string;
  content: string;
}

type Coords = { x: number; y: number };

// Named types on params — fine
function update(params: Params) {}
const move = (coords: Coords) => {};

// Primitives — fine
function greet(name: string) {}
const add = (a: number, b: number) => a + b;

// Union/intersection of named types — fine
function handle(input: string | number) {}
function merge(a: Params, b: Coords) {}

// Function type params — fine
function on(cb: (x: string) => void) {}

// Destructured with named type — fine
function destruct({ id, heading }: Params) {}
