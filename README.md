# unguard

Unguard your code. Defend against overdefensive AI-generated code.

Type-aware static analysis powered by the TypeScript compiler API.

If `??` is on a non-nullable type, you don't need it.

If `?.` is on a guaranteed object, it's noise.

unguard proves it with types.

## Install

```bash
npm install -g unguard
```

or simply

```bash
npx unguard
```

## Usage

```bash
unguard src                                  # scan files/directories
unguard src --config ./unguard.config.json   # load config
unguard src --ignore '**/*.gen.ts'           # add ignore globs
unguard src --filter no-any-cast             # run a single rule
unguard src --rule duplicate-*=warning       # override rule severity/policy
unguard src --rule category:cross-file=warning
unguard src --rule tag:safety=error
unguard src --severity=error,warning         # show errors+warnings
unguard src --fail-on=error                  # fail only on errors
unguard src --format=flat                    # one-line-per-diagnostic, grepable
unguard src --format=flat | grep error
unguard src --concurrency 1                  # disable worker-thread parallelism
unguard src --no-cache                       # bypass on-disk diagnostic cache
```

Add `unguard` to your lint check, especially if code is written by AI.

### Config

`unguard` automatically loads `./unguard.config.json` (or `./.unguardrc.json`). Use `--config <path>` to specify another file.

```json
{
  "$schema": "./node_modules/unguard/schema.json",
  "paths": ["src", "apps/web/src"],
  "ignore": ["**/*.gen.ts", "**/routeTree.gen.ts"],
  "rules": {
    "duplicate-*": "warning",
    "category:cross-file": "warning",
    "tag:safety": "error",
    "no-ts-ignore": "error",
    "prefer-*": "off"
  },
  "failOn": "error",
  "concurrency": 4,
  "cache": true
}
```

`rules` values can be `off`, `info`, `warning`, or `error`.
Selectors support:

- exact rule id: `no-ts-ignore`
- wildcard: `duplicate-*`
- category: `category:cross-file`
- tag: `tag:safety`

### Ignore behavior

`unguard` ignores:

- built-in: `node_modules`, `dist`, `.git`, declaration files (`*.d.ts`, `*.d.cts`, `*.d.mts`)
- generated files: `*.gen.*`, `*.generated.*`
- project `.gitignore`
- anything passed via `--ignore` or config `ignore`

### Exit codes

| Code | Meaning |
| ---- | ------- |
| 0 | No issues, or issues below `--fail-on` threshold |
| 1 | Failing diagnostics without errors |
| 2 | Failing diagnostics with at least one error |

Use `--fail-on=error` in CI to fail only on errors while still showing all diagnostics:

```bash
unguard src --fail-on=error
```

`--severity` filters display only. `--fail-on` evaluates all diagnostics after rule policy.

### Output formats

**Grouped** (default) -- diagnostics grouped by file:

```txt
src/lib/probe.ts
  37:4       warning  Catch swallows the error...  no-swallowed-catch
```

**Flat** (`--format=flat`) -- one line per diagnostic, grepable:

```txt
src/lib/probe.ts:37:4 warning [no-swallowed-catch] Catch swallows the error...
```

## Current Rules

### Type system evasion

| Rule | Severity | What it catches |
| ---- | -------- | --------------- |
| `no-any-cast` | error | `x as any` |
| `no-explicit-any-annotation` | error | `param: any`, `const x: any` |
| `no-inline-type-assertion` | error | `x as { ... }`, `<{ ... }>x` |
| `no-type-assertion` | error | `x as unknown as T` |
| `no-ts-ignore` | error | `@ts-ignore` / `@ts-expect-error` |

### Defensive code (type-aware)

These rules use the TypeScript type checker. Non-nullable types suppress the diagnostic; nullable types are flagged.

| Rule | Severity | What it catches |
| ---- | -------- | --------------- |
| `no-optional-property-access` | warning | `obj?.prop` on a non-nullable type |
| `no-optional-element-access` | warning | `obj?.[key]` on a non-nullable type |
| `no-optional-call` | warning | `fn?.()` on a non-nullable type |
| `no-nullish-coalescing` | warning | `x ?? fallback` on a non-nullable type |
| `no-logical-or-fallback` | warning | `map.get(k) \|\| fallback`, `count \|\| 1` -- `\|\|` swallows `0` and `""`; use `??` |
| `no-null-ternary-normalization` | warning | `x == null ? fallback : x` |
| `no-coalesce-then-guard` | warning | `const x = a ?? null; if (x == null)` -- guard re-checks the same partition the `??` just created |
| `no-await-coalesce` | warning | `await fn() ?? fallback` -- fuses the call's failure mode into the fallback (skips `Map.get`, `Array.find`, and structural optionals) |
| `no-non-null-assertion` | warning | `x!` on a nullable type without a local narrowing guard |
| `no-double-negation-coercion` | info | `!!value` |
| `no-redundant-existence-guard` | warning | `obj && obj.prop` on a non-nullable type |

### Error handling

| Rule | Severity | What it catches |
| ---- | -------- | --------------- |
| `no-swallowed-catch` | warning | `catch (e) {}`, `catch (e) { log(e); return fallback }`, `.catch(() => fallback)` -- error neither rethrown nor surfaced in the return value |
| `no-error-rewrap` | error | `throw new Error(e.message)` without `{ cause: e }` |

### Interface design

| Rule | Severity | What it catches |
| ---- | -------- | --------------- |
| `no-inline-param-type` | warning | `(params: { id: string; ... })` — inline object type on parameter |
| `prefer-default-param-value` | info | Optional param reassigned with `??` in the body |
| `prefer-required-param-with-guard` | info | `arg?: T` followed by `if (!arg) throw` |
| `no-defaulted-required-port-arg` | warning | `class C implements I { method(arg = x) }` where `I.method(arg)` is required -- the default widens the interface contract |
| `repeated-literal-property` | warning | Same literal value repeated across object properties -- likely a missed constant |
| `repeated-return-shape` | warning | Multiple functions return object literals with the same property names -- extract a shared return type |

### State management

| Rule | Severity | What it catches |
| ---- | -------- | --------------- |
| `no-module-state-write` | warning | Function mutates a module-scope binding (`count++`, `state.ready = ...`, `cache.set(...)`) |

### Cross-file analysis

| Rule | Severity | What it catches |
| ---- | -------- | --------------- |
| `duplicate-type-declaration` | warning | Same type shape in multiple files |
| `duplicate-type-name` | warning | Same exported type name, different shapes |
| `duplicate-function-declaration` | warning | Same function body in multiple files |
| `duplicate-function-name` | warning | Same exported function name, different bodies |
| `duplicate-constant-declaration` | warning | Same constant value in multiple files |
| `duplicate-inline-type-in-params` | warning | Same inline `{ ... }` param type repeated across signatures |
| `duplicate-file` | warning | File with identical content to another file |
| `near-duplicate-function` | warning | Function bodies that match after renaming params and literals -- likely a copy-paste |
| `duplicate-statement-sequence` | info | Repeated block of statements across functions or files |
| `trivial-wrapper` | info | Function that delegates to another without transformation |
| `unused-export` | info | Exported function with no usages in the project |
| `optional-arg-always-used` | warning | Optional param provided at every call site |
| `explicit-null-arg` | warning | `fn(null)` / `fn(undefined)` to project functions |
| `dead-overload` | warning | Overload signature with zero matching project call sites |

### Imports

| Rule | Severity | What it catches |
| ---- | -------- | --------------- |
| `no-dynamic-import` | error | `import("./module")` |

## Annotations

Comments near flagged lines appear in the output as context:

```typescript
// intentional escape hatch for untyped AST access
type AnyNode = Record<string, any>;
```

```txt
file.ts:2:31 error Explicit `any` annotation ... (intentional escape hatch for untyped AST access)
```

For `warning` and `info` diagnostics, you can explicitly mark a finding as intentional with `@unguard <rule-id>` on the same line or immediately above:

```typescript
// @unguard no-module-state-write module cache is intentional in this adapter
cache.set(user.id, user);
```

`@unguard` never suppresses `error` diagnostics.

## API

```typescript
import { executeScan, scan } from "unguard";

const result = await scan({ paths: ["src/"] }); // raw diagnostics
const execution = await executeScan({
  paths: ["src"],
  ignore: ["**/*.gen.ts"],
  rulePolicy: {
    "duplicate-*": "warning",
    "category:cross-file": "warning",
    "tag:safety": "error",
    "prefer-*": "off",
  },
  showSeverities: ["error", "warning"],
  failOn: "error",
});

console.log(execution.exitCode);
for (const d of execution.visibleDiagnostics) {
  console.log(`${d.file}:${d.line} [${d.ruleId}] ${d.message}`);
}
```

### Caching

unguard caches scan results under `node_modules/.cache/unguard/`. On a warm
run, if every file's content hash and the active rule set are unchanged,
unguard returns cached diagnostics without building a TypeScript program.
The cache invalidates automatically on:

- file content changes (mtime-only changes are ignored — `git checkout` and `git stash` stay cache hits)
- changes to active rules or rule severities
- changes to scan paths, ignore globs, or `failOn`
- unguard version upgrades

Disable with `--no-cache` (CLI), `cache: false` (config), or pass
`cache: false` to `executeScan({ cache: false })` programmatically.

## License

MIT
