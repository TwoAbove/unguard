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
```

Add `unguard` to your lint check, especially if code is written by AI.

### Config

`unguard` automatically loads `./unguard.config.json` (or `./.unguardrc.json`). Use `--config <path>` to specify another file.

```json
{
  "paths": ["src", "apps/web/src"],
  "ignore": ["**/*.gen.ts", "**/routeTree.gen.ts"],
  "rules": {
    "duplicate-*": "warning",
    "category:cross-file": "warning",
    "tag:safety": "error",
    "no-ts-ignore": "error",
    "prefer-*": "off"
  },
  "failOn": "error"
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
  37:4       error  Empty catch blocks hide failures...  no-empty-catch
```

**Flat** (`--format=flat`) -- one line per diagnostic, grepable:

```txt
src/lib/probe.ts:37:4 error [no-empty-catch] Empty catch blocks hide failures...
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
| `no-logical-or-fallback` | warning | `map.get(k) \|\| fallback` -- data-structure lookups where `??` is correct; `\|\|` on numeric types that swallow `0` |
| `no-null-ternary-normalization` | warning | `x == null ? fallback : x` |
| `no-non-null-assertion` | warning | `x!` on a nullable type without a local narrowing guard |
| `no-double-negation-coercion` | info | `!!value` |
| `no-redundant-existence-guard` | warning | `obj && obj.prop` on a non-nullable type |

### Error handling

| Rule | Severity | What it catches |
| ---- | -------- | --------------- |
| `no-empty-catch` | error | `catch {}` with no body and no comment |
| `no-catch-return` | warning | `catch { return fallback }` with no logging or rethrow |
| `no-error-rewrap` | error | `throw new Error(e.message)` without `{ cause: e }` |

### Interface design

| Rule | Severity | What it catches |
| ---- | -------- | --------------- |
| `prefer-default-param-value` | info | Optional param reassigned with `??` in the body |
| `prefer-required-param-with-guard` | info | `arg?: T` followed by `if (!arg) throw` |

### Cross-file analysis

| Rule | Severity | What it catches |
| ---- | -------- | --------------- |
| `duplicate-type-declaration` | warning | Same type shape in multiple files |
| `duplicate-type-name` | warning | Same exported type name, different shapes |
| `duplicate-function-declaration` | warning | Same function body in multiple files (2+ statements) |
| `duplicate-function-name` | warning | Same exported function name, different bodies |
| `duplicate-constant-declaration` | warning | Same constant value in multiple files |
| `duplicate-inline-type-in-params` | warning | Same inline `{ ... }` param type shape repeated 2+ times |
| `duplicate-file` | warning | File with identical content to another file |
| `near-duplicate-function` | warning | Function bodies identical after normalizing params, strings, numbers, `this` |
| `duplicate-statement-sequence` | info | Repeated contiguous statement blocks (3+ statements) |
| `trivial-wrapper` | info | Function that delegates to another without transformation |
| `unused-export` | info | Exported function with no usages in the project |
| `optional-arg-always-used` | warning | Optional param provided at every call site |
| `explicit-null-arg` | warning | `fn(null)` / `fn(undefined)` to project functions |

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

## License

MIT
