import { process, render } from "./callee";
process("hello", null); // @expect explicit-null-arg
render("template", undefined); // @expect explicit-null-arg
