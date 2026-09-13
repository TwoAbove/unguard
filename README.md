# unguard

Unguard your code. Defend against overdefensive AI-generated code.

Type-aware static analysis powered by the TypeScript compiler itself.

If `??` is on a non-nullable type, you don't need it.

If `?.` is on a guaranteed object, it's noise.

unguard proves it with types, and complains.

![unguard scanning a file and citing the types that prove each guard dead](https://raw.githubusercontent.com/TwoAbove/unguard/main/demo/demo.gif)

## Quick start

```bash
npx unguard
```

No config, no setup. unguard finds your tsconfig, builds a real TypeScript program, and reports only what the types prove. (`npm install -g unguard` if you prefer a global install.)

## What it catches

AI assistants pad code with guards against states the type system already rules out. Each one reads like caution, and in aggregate, they bury the real contracts. unguard reads the types and proves which guards need to be unguarded.

**Dead fallbacks** - the type says the value is always there:

```typescript
const attempts = job.attempts ?? 1; // attempts: number
```

```txt
10:20  warning  Nullish coalescing (??) fallback on a non-nullable type is dead
                code; remove the fallback or fix the type upstream
```

**Dead narrowing** - the diagnostic cites the type that decides the condition:

```typescript
if (typeof job.id !== "string") {   // id: string
  throw new Error("job is missing an id");
}
```

```txt
12:7   warning  typeof comparison is always false: `job.id` is `string`, and
                typeof always yields "string" for that type
```

**Fabricated types** - external data asserted into shape instead of validated:

```typescript
const payload = JSON.parse(job.payload) as Payload;
```

```txt
17:21  error    Casting `any`/`unknown` to a concrete type without runtime
                validation fabricates structure; validate first or narrow with
                a type guard
```

**Swallowed errors** - failure silently becomes a normal-looking value:

```typescript
try {
  return { id: job.id, attempts, payload };
} catch {
  return null;
}
```

```txt
19:5   warning  Catch swallows the error: it neither throws nor returns a value
                referencing the caught error. Propagate via throw, or model
                failure into the return type carrying the original error
```

Plus more type-system evasions (`as any`, `x as unknown as T`, `@ts-ignore`), cross-file analysis (exports nobody imports, optional parameters no call site ever passes, arguments that are the same literal everywhere, dead overloads, copy-pasted functions), and more - the full catalog is in [Current Rules](#current-rules).

## Why not just typescript-eslint?

Keep typescript-eslint - unguard is a complement to it, not a replacement. Its `no-unnecessary-condition` overlaps with a slice of `no-dead-narrowing`, and that's roughly where the overlap ends. Unguard, on the other hand, provides more:

- **Whole-project analysis.** unguard indexes every call site, import, and export across your tsconfig groups (and is monorepo-aware). Lint rules see one file at a time while unguard can prove an optional parameter is never passed, an argument is always the same literal, an export is never imported.
- **Defensive-pattern focus.** Swallowed catches detected structurally (does any expression in the catch reference the error?), `throw new Error(e.message)` losing the cause, unvalidated casts of external data, defaults that widen interface contracts.
- **Tiers split by certainty.** `scan` runs finding-tier rules whose reports demand a fix because the checker or graph demonstrates them. Cases with a correct alternative reading live in `smell` for human review.
- **Zero config.** `npx unguard` on any TypeScript repo.

## For AI coding agents

unguard is built for the verify loop. Findings are proofs with the evidence in the message, which is exactly what an agent needs to fix code instead of arguing with a style warning. Add to your `CLAUDE.md` / `AGENTS.md` / rules file:

```markdown
After changing TypeScript, run `npx unguard` and fix every finding.
Diagnostics cite the type that proves the defect - fix the code (or the type),
don't add suppressions. If a guard is genuinely intentional, annotate it:
`// @unguard <rule-id> <reason>`.
```

And gate CI:

```yaml
- name: unguard
  run: npx unguard --fail-on=error
```

## Usage

```bash
unguard                                  # scan files/directories for findings
unguard smell                            # report smells for human review
unguard fix                              # apply certified fixes, report what remains
unguard --config ./unguard.config.json   # load config
unguard --ignore '**/*.gen.ts'           # add ignore globs
unguard --only no-any-cast               # run rules matching a selector
unguard --rule duplicate-*=warning       # override rule severity/policy
unguard --rule category:cross-file=warning
unguard --rule tag:safety=error
unguard --fail-on=error                  # fail only on errors
unguard --json                           # machine-readable report
unguard baseline                         # record current findings as the baseline
unguard --no-baseline                    # ignore unguard.baseline.json for this scan
unguard --concurrency 1                  # disable worker-thread parallelism, can be slow for large codebases
unguard --no-cache                       # bypass on-disk diagnostic cache
```

### Two tiers: findings and smells

Every rule belongs to one tier:

- **finding** - the checker or graph demonstrates the report, so it demands a fix (or an explicit `@unguard` annotation). `unguard scan` runs finding-tier rules and is meant to gate CI or commits.
- **smell** - the analysis cannot see enough to choose between a likely problem and a correct alternative reading, such as deliberate duplication, an API surface for external consumers, or an intentionally optional parameter. `unguard smell` reports these for human review and exits 0 unless `--fail-on` is passed explicitly.

`--only <selector>` and explicit `rules` selections bypass the tiers - a matching rule runs in either command.

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
  "overrides": [
    {
      "files": ["tests/**", "**/*.test.ts"],
      "rules": {
        "no-non-null-assertion": "off",
        "duplicate-*": "off"
      }
    }
  ],
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
- tier: `tier:finding`, `tier:smell`

`overrides` entries apply a rule policy only to diagnostics in files matching the listed globs (gitignore syntax, relative to the working directory). Later entries win; `off` drops the diagnostic. Typical use: relaxing rules in test directories, where non-null assertions and duplication are often deliberate.

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


`unguard smell` defaults to `--fail-on=none` and exits 0 regardless of smells. Pass `--fail-on` explicitly to make it gate.

### Output formats

Grouped text output is the default, with diagnostics grouped by file:

```txt
src/lib/probe.ts
  37:4       warning  Catch swallows the error...  no-swallowed-catch
```

Use `--json` for a machine-readable report. Scan and fix reports use `findings`; smell reports use `smells`:

```json
{
  "findings": [
    {
      "file": "src/lib/probe.ts",
      "line": 37,
      "column": 4,
      "severity": "warning",
      "ruleId": "no-swallowed-catch",
      "message": "Catch swallows the error...",
      "fixable": false
    }
  ],
  "fileCount": 1,
  "exitCode": 1
}
```

### Auto-fix

`unguard fix` applies certified fixes for diagnostics with semantics-preserving replacements (dead `??` fallbacks, dead `?.`, no-op `await`, redundant casts, `cond ? true : false`, and similar), then reports what remains. The exit code reflects only the remaining findings.

### Baseline

Adopting unguard in an existing codebase? `unguard baseline src` records every current finding in `unguard.baseline.json`. Subsequent scans suppress a `(file, rule)` group as long as its count stays at or below the recorded number - new findings anywhere still fail, and fixing old ones ratchets the allowance down on the next `unguard baseline`. Use `--no-baseline` to see the full picture.

## Current Rules

The **Tier** column says which command runs the rule: `scan` for a finding or `smell` for a smell.

### Type system evasion

| Rule | Severity | Tier | What it catches |
| ---- | -------- | ---- | --------------- |
| `no-any-cast` | error | finding | `x as any` -- erases type safety for everything downstream of the cast |
| `no-explicit-any-annotation` | error | finding | `param: any`, `const x: any` -- an `any` annotation where a real type (or `unknown`) belongs |
| `no-inline-type-assertion` | error | finding | `x as { ... }`, `<{ ... }>x` -- asserting into an anonymous inline shape; name the type or fix it upstream |
| `no-type-assertion` | error | finding | `x as unknown as T` -- the double assertion that can connect any two types |
| `no-ts-ignore` | error | finding | `@ts-ignore` -- silences the checker unconditionally |
| `no-ts-expect-error` | warning | finding | `@ts-expect-error` -- self-expiring, but still an evasion |
| `no-never-cast` | warning | finding | `x as never` -- silences the checker completely, usually to force past an exhaustiveness error |
| `no-redundant-cast` | error | finding | `x as T` where `x` already has type `T` |
| `no-unvalidated-cast` | error | finding | `JSON.parse(...) as T`, `await fetch(...).json() as T` -- casting external data into a shape nothing has checked |
| `redundant-narrowing-then-cast` | warning | finding | `if (typeof x === "string") { (x as string).length }` -- the `if` already narrowed `x`, so the cast adds nothing |
| `return-type-widens-via-destructure` | warning | finding | `const [x] = await db...returning(); return x;` in a function declared to return `T` -- an array element is really `T \| undefined`, so the return type hides the empty case |

### Defensive code (type-aware)

These rules use the TypeScript type checker. Non-nullable types suppress the diagnostic; nullable types are flagged.

Nullability-driven rules require `strictNullChecks` (or `strict`). Without it the checker erases `null`/`undefined` from every type, so these rules are skipped with a warning rather than reporting every load-bearing guard as dead code.

| Rule | Severity | Tier | What it catches |
| ---- | -------- | ---- | --------------- |
| `no-optional-property-access` | warning | finding | `obj?.prop` on a non-nullable type |
| `no-optional-element-access` | warning | finding | `obj?.[key]` on a non-nullable type |
| `no-optional-call` | warning | finding | `fn?.()` on a non-nullable type |
| `no-nullish-coalescing` | warning | finding | `x ?? fallback` on a non-nullable type |
| `no-logical-or-fallback` | warning | finding | `map.get(k) \|\| fallback`, `count \|\| 1` -- `\|\|` swallows `0` and `""`; use `??` |
| `no-null-ternary-normalization` | warning | finding | `x == null ? fallback : x` -- a hand-rolled `??`: dead if the type is non-nullable, and a sign the type needs fixing if it isn't |
| `no-coalesce-then-guard` | warning | finding | `const x = a ?? null; if (x == null)` -- the `if` re-asks the question the `??` just answered |
| `no-await-coalesce` | warning | smell | `await fn() ?? fallback` -- defaulting away a call's nullable result hides why it can be empty; check it and branch instead (built-in lookups like `Map.get` and `Array.find` are exempt) |
| `no-non-null-assertion` | warning | finding | `x!` on a nullable type without a local narrowing guard |
| `no-double-negation-coercion` | warning | finding | `!!value` inside an `if`/`while`/ternary test -- the construct already coerces (`const flag = !!x` and other places that need an actual boolean are fine) |
| `no-redundant-existence-guard` | warning | finding | `obj && obj.prop` on a non-nullable type |
| `no-dead-narrowing` | warning | finding | Conditions statically decided by the operand's declared type: truthiness checks that can never fail, `typeof` comparisons that can never (or must always) match, always-true `instanceof`, type-predicate calls whose argument already has the asserted type. Exempt: ambient globals (`typeof document === "undefined"` probes the environment, not the type) and, without `noUncheckedIndexedAccess`, truthiness checks (index reads erase `undefined`, so the guard may be load-bearing) |
| `no-coalesce-undefined` | warning | finding | `x ?? undefined` where `x` can be `undefined` but never `null` -- an identity no-op |
| `redundant-boolean-branch` | warning | finding | `cond ? true : false`, `if (cond) return true; return false;` -- the condition is already boolean. The inverted form is flagged only when the replacement is a readable `!cond`; compound conditions are never rewritten into `!(a && b)` |
| `no-useless-await` | warning | finding | `await x` where `x`'s type has no `then` -- a no-op that suggests asynchrony that isn't there |
| `redundant-destructure-default` | warning | finding | `const { a = fallback } = obj` where `obj.a` is required and non-undefined -- the default can never apply |

### Error handling

| Rule | Severity | Tier | What it catches |
| ---- | -------- | ---- | --------------- |
| `no-swallowed-catch` | warning | finding | `catch (e) {}`, `.catch(() => fallback)` -- error is neither rethrown, returned, nor passed into a handling call |
| `no-error-rewrap` | error | finding | `throw new Error(e.message)` without `{ cause: e }` |

### Interface design

| Rule | Severity | Tier | What it catches |
| ---- | -------- | ---- | --------------- |
| `prefer-type-predicate` | warning | smell | `(x: unknown): boolean` whose body is `typeof`/`instanceof`/`in` checks -- returning `x is T` would let callers narrow |
| `optional-param-coerced-in-body` | warning | finding | Optional param forced non-optional in the body (`x = x ?? def`, `x ??= def`, or `if (!x) throw`) |
| `no-defaulted-required-port-arg` | warning | finding | `class C implements I { method(arg = x) }` where `I.method(arg)` is required -- the implementation quietly makes a required argument optional |
| `repeated-literal-property` | warning | smell | Same literal value repeated across object properties -- likely a missed constant |
| `repeated-return-shape` | warning | smell | Multiple functions without explicit return type annotations return object literals with the same property names -- extract a shared return type |
| `trivial-type-alias` | info | smell | `type Foo = Bar;` -- a second name for an existing type with no change (info: an alias marking a domain boundary is often deliberate) |

### Cross-file analysis

| Rule | Severity | Tier | What it catches |
| ---- | -------- | ---- | --------------- |
| `duplicate-type-declaration` | warning | smell | Same type shape in multiple files |
| `duplicate-type-name` | warning | smell | Same exported type name, different shapes |
| `duplicate-function-declaration` | warning | smell | Same function body in multiple files |
| `duplicate-function-name` | warning | smell | Same exported function name, different bodies |
| `duplicate-constant-declaration` | info | smell | Same constant value in multiple files (info: coincidental value equality is common) |
| `duplicate-inline-type-in-params` | warning | smell | Same inline `{ ... }` param type repeated across signatures |
| `duplicate-file` | warning | smell | File with identical content to another file |
| `near-duplicate-function` | warning | smell | Function bodies that match after renaming params and folding literals (strings, numbers, `null`/`undefined`) -- likely a copy-paste |
| `duplicate-statement-sequence` | warning | smell | Repeated block of statements across functions or files (identical text; lookup tables that vary only by literal data are not flagged) |
| `trivial-wrapper` | warning | smell | Function that delegates to another without transformation (skipped when the wrapper specializes a type predicate, introduces generics, reorders args, or partially applies) |
| `unused-export` | warning | smell | Exported function, type, or constant with no usages in the project. Imports resolve through the checker (path aliases, workspace packages) and usage is merged across tsconfig groups, so an export consumed by a sibling monorepo package counts as used. Consumers outside the scanned tree, such as a published package's API surface, are invisible to the analysis - hence smell tier |
| `optional-arg-always-used` | warning | smell | Optional param provided at every call site -- make it required |
| `optional-arg-never-used` | warning | smell | Optional param never provided at any call site -- remove it, inline the default |
| `constant-argument` | warning | smell | Parameter receives the same literal at every call site across scanned tsconfig groups -- inline the value |
| `explicit-null-arg` | warning | smell | `fn(null)` / `fn(undefined)` passed to a project function -- the parameter invites nullish values; redesign it so callers can omit the argument |
| `dead-overload` | warning | smell | Overload signature with zero matching call sites across scanned tsconfig groups |


### Imports

| Rule | Severity | Tier | What it catches |
| ---- | -------- | ---- | --------------- |
| `no-dynamic-import` | warning | smell | `import("./module")` -- breaks static analysis (warning, not error: code-splitting and lazy loading are legitimate) |

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
// @unguard no-nullish-coalescing intentional default for legacy callers
const port = config.port ?? 3000;
```

`@unguard` never suppresses `error` diagnostics.

## API

```typescript
import { executeScan, scan } from "unguard";

const result = await scan({ paths: ["src/"] }); // raw diagnostics
const execution = await executeScan({
  paths: ["src"],
  mode: "scan", // or "smell"
  ignore: ["**/*.gen.ts"],
  rulePolicy: {
    "duplicate-*": "warning",
    "category:cross-file": "warning",
    "tag:safety": "error",
    "prefer-*": "off",
  },
  overrides: [{ files: ["tests/**"], rules: { "no-non-null-assertion": "off" } }],
  failOn: "error",
});

console.log(execution.exitCode);
for (const d of execution.visibleDiagnostics) {
  console.log(`${d.file}:${d.line} [${d.ruleId}] ${d.message}`);
}
```

### Caching

unguard caches scan results under `node_modules/.cache/unguard/`. Before reusing
results, it refreshes project membership and module resolution, then checks
reportable files, semantic dependency hashes, and scan policy. Cache hits skip
type-checker and rule analysis, but still parse project inputs to resolve dependencies.
The cache invalidates automatically on:

- content changes in scanned files, project-context files, and imported declarations (mtime-only changes are ignored)
- added or removed project inputs, including changes to inherited `include` patterns
- changes to tsconfig, extended configurations, or package-resolution metadata
- changes to active rules or rule severities
- changes to reportable files (including `.gitignore` effects), scan paths, ignore globs, or `failOn`
- unguard version upgrades

Disable with `--no-cache` (CLI), `cache: false` (config), or pass
`cache: false` to `executeScan({ cache: false })` programmatically.

## License

MIT
