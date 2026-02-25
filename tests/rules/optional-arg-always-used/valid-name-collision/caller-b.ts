import { process } from "./module-b";
// Calls module-b's process with 2 args — name-based matching would see these
// as calls to module-a's "process" and think arg 2 is always provided
process(42, 2);
process(99, 3);
