import { process } from "./module-a";
// Only 1 call to module-a's process — below the 2-call-site threshold
process("hello", true);
