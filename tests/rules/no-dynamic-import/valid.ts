import { readFileSync } from "node:fs";
import type { Node } from "oxc-parser";

const data = readFileSync("file.txt", "utf8");
