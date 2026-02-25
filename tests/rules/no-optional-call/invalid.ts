declare const fn: () => void;
declare const obj: { method: () => void };

fn?.(); // @expect no-optional-call
obj.method?.(); // @expect no-optional-call
