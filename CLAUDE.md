# unguard

Type-aware static analyzer that flags defensive coding patterns where types should guarantee correctness.

## Commands

```bash
npm run build          # tsup -> dist/
npm run lint:biome     # biome lint for source + tests (without fixtures)
npm run test           # vitest run
npm run test:watch     # vitest
npm run typecheck      # tsc --noEmit
npm run scan           # run unguard on src + maintained tests with fail-on=error
```

CLI: `node bin/unguard.mjs scan [paths] [--config <path>] [--strict] [--filter <rule-id>] [--rule <selector=severity>] [--ignore <glob>] [--severity=<levels>] [--fail-on=<none|error|warning|info>] [--format=grouped|flat]`

Config: `unguard.config.json` (auto-discovered) supports `paths`, `ignore`, `rules`, `failOn`.
Rule severity values: `off | info | warning | error`; selectors support:
- exact id (`no-ts-ignore`)
- wildcard (`duplicate-*`)
- `category:<name>` (example: `category:cross-file`)
- `tag:<name>` (example: `tag:safety`)
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
- `src/typecheck/utils.ts` — shared type helpers (`isNullableType`, `includesNumberType`, etc.)
- `src/collect/index.ts` — `collectProject(program)`, builds `ProjectIndex`
- `src/rules/index.ts` — rule registry + rule metadata catalog (`category`, `tags`)

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

Register in `src/rules/index.ts`.

#### TSVisitContext

- `ctx.report(node, message?)` — emit diagnostic
- `ctx.reportAtOffset(offset, message?)` — emit at arbitrary offset
- `ctx.isNullable(node)` — type includes null/undefined
- `ctx.isExternal(node)` — declaration from node_modules
- `ctx.checker` — full `ts.TypeChecker`
- `ctx.sourceFile`, `ctx.source`, `ctx.filename`

### Cross-file rules

Rules live in `src/rules/cross-file/`. Each exports a `CrossFileRule` with `analyze(project: ProjectIndex)`. The `ProjectIndex` provides registries, call sites, and imports. Function/call-site entries carry `symbol?: ts.Symbol` for cross-module matching by declaration identity.

### TS AST patterns

| Pattern | TS API |
|---------|--------|
| `x ?? y` | `ts.isBinaryExpression(node)`, `QuestionQuestionToken` |
| `obj?.prop` | `ts.isPropertyAccessExpression(node) && node.questionDotToken` |
| `x!` | `ts.isNonNullExpression(node)` |
| `x as T` | `ts.isAsExpression(node)` |
| `catch (e) {}` | `ts.isCatchClause(node)`, `node.block.statements` |
| Comments | `ts.getLeadingCommentRanges(source, node.getFullStart())` |

## Testing rules

Each rule has a test directory: `tests/rules/<rule-id>/`

```
tests/rules/no-empty-catch/
  valid.ts                    # should NOT trigger
  invalid.ts                  # SHOULD trigger, with annotations
  no-empty-catch.test.ts      # vitest
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
- Test every rule with both valid and invalid fixtures.
