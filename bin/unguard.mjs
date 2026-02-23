#!/usr/bin/env node

import path from "node:path";
import { fileURLToPath } from "node:url";
import crossSpawn from "cross-spawn";

const binDir = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(binDir, "..");
const localBinDir = path.join(packageRoot, "node_modules", ".bin");

const rulepacks = [
  {
    configPath: path.join(packageRoot, "rulepacks", "ts", "sgconfig.yml"),
    globs: ["**/*.ts", "**/*.cts", "**/*.mts"],
  },
  {
    configPath: path.join(packageRoot, "rulepacks", "tsx", "sgconfig.yml"),
    globs: ["**/*.tsx"],
  },
];

const rawArgs = process.argv.slice(2);
const firstArg = rawArgs[0];

if (firstArg === "-h" || firstArg === "--help") {
  console.log(`unguard: data-shape AST checker

Usage:
  unguard scan [paths...] [ast-grep scan options]
  unguard scan [paths...] --strict
  unguard [paths...] [ast-grep scan options]

Examples:
  unguard scan src
  unguard scan src --filter no-loose-nullish-check
  unguard scan src --strict
  unguard src --strict
`);
  process.exit(0);
}

const userArgs = firstArg === "scan" ? rawArgs.slice(1) : rawArgs;
const strictMode = userArgs.includes("--strict");
const forwardedArgs = userArgs.filter((a) => a !== "--strict");

const envPath = process.env.PATH
  ? `${localBinDir}${path.delimiter}${process.env.PATH}`
  : localBinDir;

let finalStatus = 0;
for (const rulepack of rulepacks) {
  const scanArgs = ["scan", "--config", rulepack.configPath, ...forwardedArgs];
  for (const glob of rulepack.globs) {
    scanArgs.push("--globs", glob);
  }
  if (strictMode) {
    scanArgs.push("--error");
  }

  const result = crossSpawn.sync("ast-grep", scanArgs, {
    stdio: "inherit",
    env: { ...process.env, PATH: envPath },
  });

  if (result.error) {
    if (result.error.code === "ENOENT") {
      console.error(
        "ast-grep binary not found. Run `npm install` in this package or install @ast-grep/cli globally.",
      );
    }
    console.error(result.error.message);
    process.exit(1);
  }

  if ((result.status ?? 0) !== 0) {
    finalStatus = result.status ?? 1;
  }
}

process.exit(finalStatus);
