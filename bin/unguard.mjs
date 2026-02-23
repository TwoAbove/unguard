#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const binDir = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(binDir, "..");
const localBinDir = path.join(packageRoot, "node_modules", ".bin");
const astGrepBinary = process.platform === "win32" ? "ast-grep.cmd" : "ast-grep";

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
  console.log(
    "unguard: data-shape AST checker\n\nUsage:\n  unguard scan [paths...] [ast-grep scan options]\n  unguard scan [paths...] --strict\n  unguard [paths...] [ast-grep scan options]\n\nNotes:\n  - Runs both language rulepacks: TypeScript and TSX\n\nExamples:\n  unguard scan src\n  unguard scan src --filter no-loose-nullish-check\n  unguard scan src --strict\n  unguard src --strict\n",
  );
  process.exit(0);
}

const isScanCommand = firstArg === "scan";
const userArgs = isScanCommand ? rawArgs.slice(1) : rawArgs;

const forwardedArgs = [];
let strictMode = false;
for (const arg of userArgs) {
  if (arg === "--strict") {
    strictMode = true;
    continue;
  }
  forwardedArgs.push(arg);
}

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

  const result = spawnSync(astGrepBinary, scanArgs, {
    stdio: "inherit",
    env: {
      ...process.env,
      PATH: envPath,
    },
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