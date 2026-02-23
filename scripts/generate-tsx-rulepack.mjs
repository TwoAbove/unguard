#!/usr/bin/env node

/**
 * Generates the tsx rulepack from the canonical ts rulepack.
 * Only difference: language becomes Tsx, and patterns ambiguous
 * in JSX (angle-bracket type assertions) are dropped.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseAllDocuments, stringify } from "yaml";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tsDir = path.join(root, "rulepacks", "ts");
const tsxDir = path.join(root, "rulepacks", "tsx");

const tsRulesDir = path.join(tsDir, "rules");
const tsxRulesDir = path.join(tsxDir, "rules");
const tsUtilsDir = path.join(tsDir, "utils");
const tsxUtilsDir = path.join(tsxDir, "utils");
const tsTestsDir = path.join(tsDir, "rule-tests");
const tsxTestsDir = path.join(tsxDir, "rule-tests");

// Patterns that are ambiguous in JSX and must be removed for tsx.
// Keyed by rule id, value is a predicate that returns true for patterns to DROP.
const tsxPatternFilters = {
  "no-any-cast": (pattern) => {
    if (typeof pattern === "object" && pattern.context) {
      return pattern.context.includes("<any>");
    }
    return false;
  },
};

function transformRule(doc) {
  const rule = doc.toJSON();
  rule.language = "Tsx";

  const filter = tsxPatternFilters[rule.id];
  if (filter && rule.rule?.any) {
    rule.rule.any = rule.rule.any.filter((entry) => {
      const pattern = entry.pattern ?? entry;
      return !filter(pattern);
    });
    // Unwrap single-element `any` array to just the pattern
    if (rule.rule.any.length === 1) {
      rule.rule = rule.rule.any[0];
    }
  }

  return rule;
}

// Clean generated files, preserve test snapshots
fs.rmSync(tsxRulesDir, { recursive: true, force: true });
fs.rmSync(tsxUtilsDir, { recursive: true, force: true });
fs.mkdirSync(tsxRulesDir, { recursive: true });
fs.mkdirSync(tsxUtilsDir, { recursive: true });
fs.mkdirSync(tsxTestsDir, { recursive: true });
for (const file of fs.readdirSync(tsxTestsDir)) {
  if (file.endsWith(".yml")) fs.rmSync(path.join(tsxTestsDir, file));
}

// Generate rules
for (const file of fs.readdirSync(tsRulesDir)) {
  if (!file.endsWith(".yml")) continue;
  const src = fs.readFileSync(path.join(tsRulesDir, file), "utf8");
  const docs = parseAllDocuments(src);
  const transformed = docs.map((doc) => stringify(transformRule(doc)));
  fs.writeFileSync(path.join(tsxRulesDir, file), transformed.join("---\n"));
}

// Generate utils
for (const file of fs.readdirSync(tsUtilsDir)) {
  if (!file.endsWith(".yml")) continue;
  const src = fs.readFileSync(path.join(tsUtilsDir, file), "utf8");
  const docs = parseAllDocuments(src);
  const transformed = docs.map((doc) => stringify(transformRule(doc)));
  fs.writeFileSync(path.join(tsxUtilsDir, file), transformed.join("---\n"));
}

// Copy tests (identical between ts and tsx)
for (const file of fs.readdirSync(tsTestsDir)) {
  if (file === "__snapshots__") continue;
  fs.copyFileSync(path.join(tsTestsDir, file), path.join(tsxTestsDir, file));
}

// Copy sgconfig.yml
fs.copyFileSync(
  path.join(tsDir, "sgconfig.yml"),
  path.join(tsxDir, "sgconfig.yml"),
);

console.log("Generated tsx rulepack from ts source.");
