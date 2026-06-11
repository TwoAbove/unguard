# unguard

Type-aware static analyzer that flags defensive coding patterns where types should guarantee correctness.

## Commands

```bash
npm run build          # tsup -> dist/
npm run lint:biome     # biome lint for source + tests (without fixtures)
npm run test           # vitest run
npm run test:watch     # vitest
npm run typecheck      # tsc --noEmit
npm run scan           # run unguard on src via unguard.config.json (fail-on=error)
```

CLI: `node bin/unguard.mjs scan [paths] [--config <path>] [--strict] [--filter <rule-id>] [--rule <selector=severity>] [--ignore <glob>] [--severity=<levels>] [--fail-on=<none|error|warning|info>] [--format=grouped|flat|json] [--fix] [--no-baseline] [--no-cache]`

Rule tiers (`RuleConfidence` in `src/rules/index.ts`): every rule is `proven` (checker/AST demonstrates the defect — every finding demands a fix) or `heuristic` (pattern evidence with a possible correct alternative reading). `scan` runs proven rules; the `audit` subcommand runs heuristic rules with `--fail-on` defaulting to `none`, so it never gates unless asked to. An explicit rule selection (`--filter`, `rules` option) bypasses the tiers.

`baseline` subcommand: `node bin/unguard.mjs baseline [paths]` writes `unguard.baseline.json` (per file+rule counts). Scans auto-load it; a (file, rule) group is suppressed while its count stays ≤ the recorded number. `--no-baseline` ignores it.

`--fix` applies `Diagnostic.fix` edits (only attached when provably semantics-preserving), then reports and exits on what remains.

Config: `unguard.config.json` (auto-discovered) supports `paths`, `ignore`, `rules`, `overrides`, `failOn`.
Rule severity values: `off | info | warning | error`; selectors support:
- exact id (`no-ts-ignore`)
- wildcard (`duplicate-*`)
- `category:<name>` (example: `category:cross-file`)
- `tag:<name>` (example: `tag:safety`)
- `confidence:<proven|heuristic>`
`overrides` is an array of `{ files: [globs], rules: { selector: severity } }` — path-scoped rule policy applied post-analysis to diagnostics in matching files (gitignore syntax, cwd-relative; `off` drops). See `applyOverrides` in `src/scan/policy.ts`.
Ignore source: built-ins + generated files (`*.gen.*`, `*.generated.*`) + `.gitignore` + CLI/config ignore globs.

Exit codes:
- `0`: clean or below `fail-on` threshold
- `1`: threshold met without errors
- `2`: threshold met with at least one error

## Architecture

Pipeline is explicit and ordered:

1. **Resolve config** (`src/scan/config.ts`) — merge defaults + caller options, normalize rule policy and thresholds.
2. **Discover files** (`src/scan/discover.ts`) — expand targets, apply built-in/generated ignores, apply `.gitignore`.
3. **Analyze** (`src/scan/analyze.ts`) — run TS + cross-file rules using one `ts.Program`.
4. **Classify/report policy** (`src/scan/policy.ts`) — resolve selector-based severities, output visibility, exit code.

Orchestration entrypoints:
- `scan()` returns raw diagnostics (`src/engine.ts`)
- `executeScan()` returns diagnostics + visible diagnostics + exit code (`src/engine.ts`)

Other key files:
- `src/typecheck/program.ts` — tsconfig discovery, `ts.Program` creation
- `src/typecheck/walk.ts` — TS AST walker, `TSVisitContext`, `runTSRules()`
- `src/typecheck/utils.ts` — shared type helpers (`isNullableType`, `includesNumberType`, `isInlineParamType`, `isPromiseLike`, `libDeclaredSignature`, `reportCommentDirectives`, etc.)
- `src/scan/baseline.ts` — baseline load/build/apply (`unguard.baseline.json`)
- `src/rules/cross-file/object-shape.ts` — shared helpers for object literal shape analysis (`extractPropertyNames`, `getShapeGroup`)
- `src/collect/index.ts` — `collectProject(program)`, builds `ProjectIndex` (types, functions, constants, callSites, imports, fileHashes, statementSequences, inlineParamTypes)
- `src/collect/base-registry.ts` — `BaseRegistry<T>` and `DualHashRegistry<T>` base classes
- `src/rules/index.ts` — rule registry + rule metadata catalog (`category`, `tags`, `confidence`)
- `src/utils/hash.ts` — hashing: `hashTypeShape`, `hashFunctionBody`, `normalizeBody`, `normalizeText`

## Writing rules

### Single-file (TS) rules

Rules live in `src/rules/ts/`. Each exports a `TSRule`. The `visit()` callback fires for every AST node.

```typescript
import * as ts from "typescript";
import type { TSRule, TSVisitContext } from "../types.ts";

export const myRule: TSRule = {
  kind: "ts",
  id: "my-rule",
  severity: "warning",
  message: "Human-readable explanation",

  visit(node: ts.Node, ctx: TSVisitContext) {
    if (!ts.isCatchClause(node)) return;
    if (node.block.statements.length === 0) {
      ctx.report(node);
    }
  },
};
```

Register in `src/rules/index.ts` (both `allRules` and the metadata catalog — `getRuleMetadata` throws on rules without an entry). The catalog entry must classify `confidence: "proven" | "heuristic"`: if deleting or changing the flagged code could ever be wrong while the types are honest, the rule is heuristic; otherwise proven. Add the rule to the appropriate table in `README.md`, including the Tier column.

Optional `TSRule` fields:
- `syntaxKinds: ts.SyntaxKind[]` — dispatch `visit()` only for these node kinds (perf)
- `requiresTypeInfo: false` — rule is purely syntactic
- `requiresStrictNullChecks: true` — rule is skipped (with a warning) when the tsconfig group lacks strictNullChecks
- attach a `fix: FixEdit` (`{start, end, text}`) via `ctx.report(node, message, fix)` only when the replacement is provably semantics-preserving; `--fix` applies it mechanically

#### TSVisitContext

- `ctx.report(node, message?, fix?)` — emit diagnostic
- `ctx.reportAtOffset(offset, message?)` — emit at arbitrary offset
- `ctx.isNullable(node)` — type includes null/undefined
- `ctx.isExternal(node)` — declaration from node_modules
- `ctx.checker` — full `ts.TypeChecker`
- `ctx.sourceFile`, `ctx.source`, `ctx.filename`

### Cross-file rules

Rules live in `src/rules/cross-file/`. Each exports a `CrossFileRule` with `analyze(project: ProjectIndex)`. The `ProjectIndex` provides registries, call sites, and imports. Function/call-site entries carry `symbol?: ts.Symbol` for cross-module matching by declaration identity.

Analysis runs one tsconfig group at a time. A rule that would mistake another group's usage for absence (e.g. `unused-export` in a monorepo) additionally implements `collectGlobalFacts(project, context)` + `finalizeGlobal(facts[])`: facts are collected per group (possibly in a worker, so they must survive `structuredClone` — no `ts.Node`/`ts.Symbol`), then merged once on the main thread. Keep `analyze()` as the single-group equivalent (`finalize([collectFacts(project, context)])`) — the test harness calls it directly.

### TS AST patterns

| Pattern | TS API |
|---------|--------|
| `x ?? y` | `ts.isBinaryExpression(node)`, `QuestionQuestionToken` |
| `obj?.prop` | `ts.isPropertyAccessExpression(node) && node.questionDotToken` |
| `x!` | `ts.isNonNullExpression(node)` |
| `x as T` | `ts.isAsExpression(node)` |
| `catch (e) {}` | `ts.isCatchClause(node)`, `node.block.statements` |
| `x as const` | `ts.isAsExpression(node)`, `node.type.getText(sf) === "const"` |
| `{ k: v }` | `ts.isObjectLiteralExpression(node)`, `ts.isPropertyAssignment(prop)` |
| Comments | `ts.getLeadingCommentRanges(source, node.getFullStart())` |

## Testing rules

Each rule has a test directory: `tests/rules/<rule-id>/`

```
tests/rules/no-swallowed-catch/
  valid.ts                    # should NOT trigger
  invalid.ts                  # SHOULD trigger, with annotations
  no-swallowed-catch.test.ts  # vitest
```

Mark expected diagnostics with `// @expect <rule-id>`.

Type-aware fixtures need declarations so the checker can reason about types:

```typescript
// valid.ts
declare const maybe: string | null;
const z = maybe ?? "default";

// invalid.ts
declare const str: string;
const x = str ?? "fallback"; // @expect no-nullish-coalescing
```

Harness (`tests/harness.ts`):
- `assertValid(rule, fixturePath)` — expects 0 diagnostics
- `assertInvalid(rule, fixturePath)` — expects diagnostics on `@expect` lines
- `assertCrossFileValid(rule, fixtureDir)` — cross-file, expects 0
- `assertCrossFileInvalid(rule, fixtureDir)` — cross-file, matches `@expect`

```typescript
import { describe, it } from "vitest";
import { assertValid, assertInvalid } from "../../harness.ts";
import { myRule } from "../../../src/rules/ts/my-rule.ts";

describe("my-rule", () => {
  it("allows valid code", () => {
    assertValid(myRule, new URL("./valid.ts", import.meta.url).pathname);
  });
  it("flags invalid code", () => {
    assertInvalid(myRule, new URL("./invalid.ts", import.meta.url).pathname);
  });
});
```

## Constraints

- ESM only. No CJS.
- Dogfood: `npm run scan` must report 0 issues.
- CLI uses `dist/` — run `npm run build` before testing via `bin/unguard.mjs`.
- Test every rule with both valid and invalid fixtures.

## Hard rule: structure and types, never names

Rules MUST detect via AST structure and TypeScript types. They MUST NOT key on identifier names, method names, message strings, or library-specific identifiers. A rule whose precision depends on "function is called `isFoo`", "message contains 'not found'", or "the call is `Sentry.captureException`" is broken by design — it fails the moment the user renames things, and it ties unguard to a particular ecosystem.

Forbidden in rule logic and in user-facing config:
- Substring/prefix/suffix matches on identifier names (`name.startsWith("is")`, `name.includes("validator")`).
- Hardcoded lists of library function names (`["Sentry.captureException", "posthog.capture", ...]`).
- Config knobs that ask the user to enumerate identifiers (`errorSinks: [...]`, `validatorNames: [...]`).
- Detecting intent from message strings or comment contents.

Allowed:
- AST node kinds and shapes (`ts.isCatchClause`, `ts.isAsExpression`, argument counts, child structure).
- Types via the checker (`isNullable`, type-literal shape, discriminated-union detection, predicate vs `boolean` return).
- Symbol identity for cross-module matching (`symbol === fn.symbol`).
- AST-defined markers that are part of the syntax, not user-chosen names: JSDoc tags (`@deprecated`), `@ts-ignore`, `@unguard`, `as const`.

The test: if a user could rename every function and variable in their codebase without changing the diagnostics, the rule is structural. If a rename breaks the rule, the rule is wrong.

Example — the right way to detect "error was handed off in a catch": walk the catch body for any `CallExpression` whose argument tree references the catch binding. That's structural — works for any sink, any library, any naming convention. The wrong way: maintain a list of known sink names.
