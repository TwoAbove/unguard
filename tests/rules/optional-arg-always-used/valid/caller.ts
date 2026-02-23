import { greet } from "./callee";
greet("Alice", "Hi");
greet("Bob"); // This call omits greeting — optional is justified
