// "shared" used across different property keys — not a discriminant, genuine DRY violation
function f1() { return { name: "shared", x: 1 }; } // @expect repeated-literal-property
function f2() { return { label: "shared", x: 2 }; }
function f3() { return { title: "shared", x: 3 }; }
function f4() { return { desc: "shared", x: 4 }; }
function f5() { return { alt: "shared", x: 5 }; }
