// Shape {x, y} appears 5 times
const a = { x: 1, y: 2 }; // @expect repeated-object-shape
const b = { x: 3, y: 4 }; // @expect repeated-object-shape
const c = { x: 5, y: 6 }; // @expect repeated-object-shape
const d = { y: 7, x: 8 }; // @expect repeated-object-shape
const e = { x: 9, y: 10 }; // @expect repeated-object-shape
