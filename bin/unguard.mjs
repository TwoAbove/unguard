#!/usr/bin/env node
import { main } from "../dist/cli.js";
main(process.argv).then((code) => process.exit(code));
