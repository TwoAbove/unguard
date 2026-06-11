import { once, rest, send, spreadTarget } from "./callee";

declare const args: [string];

// One site does provide the optional argument.
send("hello");
send("goodbye", true);

// Single call site: not enough signal.
once("solo");

// A spread makes provided arity unknowable.
spreadTarget("a");
spreadTarget(...args);

// Rest params have open-ended arity.
rest("x");
rest("y");
