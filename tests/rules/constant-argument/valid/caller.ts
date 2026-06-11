import { fetchRows, fromVariable, twice } from "./callee";

declare const pageSize: number;

// Differing literals: the parameter is real.
fetchRows("users", 100);
fetchRows("orders", 50);
fetchRows("events", 100);

// Only two call sites: not enough signal.
twice("users", 100);
twice("orders", 100);

// A non-literal argument makes the value site-dependent.
fromVariable("users", 100);
fromVariable("orders", 100);
fromVariable("events", pageSize);
