import { readFileSync } from "node:fs";
import type { Node } from "typescript";

const data = readFileSync("file.txt", "utf8");
