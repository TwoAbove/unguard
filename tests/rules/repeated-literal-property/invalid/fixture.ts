// as const across 3 scopes — hits threshold
function ok1() { return { _tag: "Ok" as const, data: 1 }; } // @expect repeated-literal-property
function ok2() { return { _tag: "Ok" as const, data: 2 }; }
function ok3() { return { _tag: "Ok" as const, data: 3 }; }

// Plain literal across 5 scopes — hits threshold
function t1() { return { type: "text", value: 1 }; } // @expect repeated-literal-property
function t2() { return { type: "text", value: 2 }; }
function t3() { return { type: "text", value: 3 }; }
function t4() { return { type: "text", value: 4 }; }
function t5() { return { type: "text", value: 5 }; }
