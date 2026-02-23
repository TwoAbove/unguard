# unguard

Unguard your code. Defend agains overdefensive AI-generated code.

Built on [oxc-parser](https://github.com/nicolo-ribaudo/oxc-parser-js).

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
unguard src/ --strict           # treat warnings as errors (CI)
unguard src/ --filter no-any-cast  # run a single rule
```

Add `unguard` to your lint check.

## Current Rules

### Type system evasion

| Rule | What it catches |
|------|----------------|
| `no-any-cast` | `x as any` |
| `no-explicit-any-annotation` | `param: any`, `const x: any` |
| `no-type-assertion` | `x as unknown as T` |
| `no-ts-ignore` | `@ts-ignore` / `@ts-expect-error` |

### Defensive code

| Rule | What it catches |
|------|----------------|
| `no-optional-property-access` | `obj?.prop` |
| `no-optional-element-access` | `obj?.[key]` |
| `no-optional-call` | `fn?.()` |
| `no-nullish-coalescing` | `x ?? fallback` |
| `no-logical-or-fallback` | `x \|\| fallback` |
| `no-null-ternary-normalization` | `x == null ? fallback : x` |
| `no-non-null-assertion` | `x!` |
| `no-double-negation-coercion` | `!!value` |
| `no-redundant-existence-guard` | `obj && obj.prop` |

### Error handling

| Rule | What it catches |
|------|----------------|
| `no-empty-catch` | `catch {}` with no body |
| `no-catch-return` | `catch { return fallback }` without rethrowing |
| `no-error-rewrap` | `throw new Error(e.message)` without `{ cause: e }` |

### Interface design

| Rule | What it catches |
|------|----------------|
| `no-inline-type-in-params` | `fn(opts: { a: string; b: number })` |
| `prefer-default-param-value` | Optional param reassigned with `??` in the body |
| `prefer-required-param-with-guard` | `arg?: T` followed by `if (!arg) throw` |

### Cross-file analysis

| Rule | What it catches |
|------|----------------|
| `duplicate-type-declaration` | Same type shape in multiple files |
| `duplicate-type-name` | Same exported type name, different shapes |
| `duplicate-function-declaration` | Same function body in multiple files |
| `duplicate-function-name` | Same exported function name, different bodies |
| `optional-arg-always-used` | Optional param provided at every call site |
| `explicit-null-arg` | `fn(null)` / `fn(undefined)` to project functions |

### Imports

| Rule | What it catches |
|------|----------------|
| `no-dynamic-import` | `import("./module")` |

## Annotations

Comments near flagged lines appear in the output as context:

```typescript
// intentional escape hatch for untyped AST access
type AnyNode = Record<string, any>;
```

```txt
file.ts:2:31 warning Explicit `any` annotation ... (intentional escape hatch for untyped AST access)
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
