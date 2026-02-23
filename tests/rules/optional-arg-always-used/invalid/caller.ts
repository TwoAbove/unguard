import { greet } from "./callee";
greet("Alice", "Hi");
greet("Bob", "Hey");
// Every call provides `greeting` — it should be required
