# unguard

Unguard your code. Defend against overdefensive AI-generated code.

Built on [oxc-parser](https://oxc.rs).

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
unguard src/
unguard src/ --strict              # treat warnings as errors (CI)
unguard src/ --filter no-any-cast  # run a single rule
unguard src/ --severity=error      # only show errors
unguard src/ --format=flat         # one-line-per-diagnostic, grepable
unguard src/ --format=flat | grep error
```

Add `unguard` to your lint check.

### Exit codes

| Code | Meaning |
| ---- | ------- |
| 0 | No issues |
| 1 | Warnings or info only |
| 2 | At least one error |

Use `--severity=error` in CI to only fail on errors:

```bash
unguard src/ --severity=error || exit 1
```

### Output formats

**Grouped** (default) — diagnostics grouped by file:

```txt
src/lib/probe.ts
  37:4       error  Empty catch blocks hide failures...  no-empty-catch
```

**Flat** (`--format=flat`) — one line per diagnostic, grepable:

```txt
src/lib/probe.ts:37:4 error [no-empty-catch] Empty catch blocks hide failures...
```

## Current Rules

### Type system evasion

| Rule | Severity | What it catches |
| ---- | -------- | --------------- |
| `no-any-cast` | error | `x as any` |
| `no-explicit-any-annotation` | error | `param: any`, `const x: any` |
| `no-type-assertion` | error | `x as unknown as T` |
| `no-ts-ignore` | error | `@ts-ignore` / `@ts-expect-error` |

### Defensive code

| Rule | Severity | What it catches |
| ---- | -------- | --------------- |
| `no-optional-property-access` | info | `obj?.prop` |
| `no-optional-element-access` | info | `obj?.[key]` |
| `no-optional-call` | info | `fn?.()` |
| `no-nullish-coalescing` | info | `x ?? fallback` |
| `no-logical-or-fallback` | warning | `x \|\| fallback` |
| `no-null-ternary-normalization` | warning | `x == null ? fallback : x` |
| `no-non-null-assertion` | warning | `x!` |
| `no-double-negation-coercion` | info | `!!value` |
| `no-redundant-existence-guard` | warning | `obj && obj.prop` |

### Error handling

| Rule | Severity | What it catches |
| ---- | -------- | --------------- |
| `no-empty-catch` | error | `catch {}` with no body (comments count as annotation) |
| `no-catch-return` | warning | `catch { return fallback }` without rethrowing |
| `no-error-rewrap` | error | `throw new Error(e.message)` without `{ cause: e }` |

### Interface design

| Rule | Severity | What it catches |
| ---- | -------- | --------------- |
| `no-inline-type-in-params` | info | `fn(opts: { a: string; b: number })` |
| `prefer-default-param-value` | info | Optional param reassigned with `??` in the body |
| `prefer-required-param-with-guard` | info | `arg?: T` followed by `if (!arg) throw` |

### Cross-file analysis

| Rule | Severity | What it catches |
| ---- | -------- | --------------- |
| `duplicate-type-declaration` | error | Same type shape in multiple files |
| `duplicate-type-name` | error | Same exported type name, different shapes |
| `duplicate-function-declaration` | error | Same function body in multiple files |
| `duplicate-function-name` | error | Same exported function name, different bodies |
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
import { scan } from "unguard";

const result = await scan({ paths: ["src/"] });
for (const d of result.diagnostics) {
  console.log(`${d.file}:${d.line} [${d.ruleId}] ${d.message}`);
}
```

## License

MIT
