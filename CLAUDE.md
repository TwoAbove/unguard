# unguard

Static analyzer that flags defensive coding patterns where types should guarantee correctness. If a value's type proves it can't be null, the `??` fallback is noise. If a catch block is empty, the error is silently swallowed. unguard finds these.

## Commands

```bash
npm run build          # tsup -> dist/
npm run test           # vitest run
npm run test:watch     # vitest
npm run typecheck      # tsc --noEmit
npm run scan           # run unguard on itself
```

CLI usage: `node bin/unguard.mjs scan [paths] [--strict] [--filter <rule-id>]`

## Architecture

**Parser:** `oxc-parser` (ESTree AST). **Walker:** `oxc-walker` (traversal with parent tracking).

**Two-pass design** (pass 2 not yet implemented):
- Pass 1: Parse files, walk ASTs, run single-file visitor rules. (Future: also build project-wide indices for cross-file analysis.)
- Pass 2: Run cross-file rules against collected indices. (Not yet built — see `docs/plans/`.)

Entry points:
- `src/engine.ts` — `scan()` orchestrates file discovery, parsing, rule execution
- `src/cli.ts` — CLI wrapper, output formatting
- `src/index.ts` — public API re-exports

## Writing rules

Rules live in `src/rules/single-file/`. Each file exports a single `SingleFileRule` constant.

A rule's `visit()` is called for every AST node. Guard on `node.type`, inspect properties, call `ctx.report(node)` to emit a diagnostic.

```typescript
import type { Node } from "oxc-parser";
import type { SingleFileRule, VisitContext } from "../types.ts";
import { child, children, prop } from "../../utils/narrow.ts";

export const myRule: SingleFileRule = {
  id: "my-rule",
  severity: "warning",
  message: "Human-readable explanation of what's wrong and what to do instead",

  visit(node: Node, parent: Node | null, ctx: VisitContext) {
    if (node.type !== "CatchClause") return;
    const body = child(node, "body");
    if (body && body.type === "BlockStatement" && children(body, "body").length === 0) {
      ctx.report(node);
    }
  },
};
```

After creating a rule, register it in `src/rules/index.ts`.

### oxc-parser runtime vs types

**Critical:** `@oxc-project/types` defines `NullLiteral`, `StringLiteral`, `NumericLiteral`, etc., but at runtime oxc-parser emits `"Literal"` for all of them. The `Node` union's discriminated narrowing will not work correctly for literals. Always verify runtime `node.type` values with a quick script before relying on type narrowing:

```bash
node -e "const {parseSync}=require('oxc-parser'); const {walk}=require('oxc-walker'); const r=parseSync('t.ts','YOUR CODE'); walk(r.program,{enter(n){console.log(n.type,n.start)}})"
```

### Accessing node properties

Never use `as any`. Use the helpers from `src/utils/narrow.ts`:

- `prop<T>(node, "key")` — read a scalar property
- `child(node, "key")` — read a child node (returns `Node | null`)
- `children(node, "key")` — read a child node array (returns `Node[]`)

These contain the single `as any` boundary so rule code stays clean.

### Comment-based rules

Comments are not AST nodes in oxc-parser. They come from `parseSync().comments` as `{ type: "Line" | "Block", value: string, start: number, end: number }`. To match comments, implement `visitComment?()` on your rule. See `no-ts-ignore.ts`.

## Testing rules

Each rule has a test directory: `tests/rules/<rule-id>/`

```
tests/rules/no-empty-catch/
  valid.ts                    # code that should NOT trigger
  invalid.ts                  # code that SHOULD trigger, with annotations
  no-empty-catch.test.ts      # vitest test file
```

**Annotation convention:** Mark lines that should produce diagnostics with `// @expect <rule-id>`. The annotation goes on the line where the **matched node starts** (its `start` byte offset maps to that line).

```typescript
// invalid.ts
try {
  riskyOperation();
} catch (err) {} // @expect no-empty-catch
```

The test harness (`tests/harness.ts`) provides:
- `assertValid(rule, fixturePath)` — expects 0 diagnostics
- `assertInvalid(rule, fixturePath)` — expects diagnostics exactly on `@expect`-annotated lines

Test file pattern:
```typescript
import { describe, it } from "vitest";
import { assertValid, assertInvalid } from "../../harness.ts";
import { myRule } from "../../../src/rules/single-file/my-rule.ts";

describe("my-rule", () => {
  it("allows valid code", () => {
    assertValid(myRule, new URL("./valid.ts", import.meta.url).pathname);
  });
  it("flags invalid code", () => {
    assertInvalid(myRule, new URL("./invalid.ts", import.meta.url).pathname);
  });
});
```

## Project status

Tasks 1-7 complete. Tasks 8-15 remain (cross-file analysis, old infrastructure cleanup, real-project validation). See `docs/plans/2026-02-23-oxc-rewrite-plan.md` for the full plan. The `rulepacks/` and `scripts/` directories contain the old ast-grep YAML infrastructure that will be deleted once cross-file rules are done.

## Constraints

- ESM only. No CJS.
- No `as any` in `src/` outside of `src/utils/narrow.ts`.
- Test every rule with both valid and invalid fixtures.
- Do not copy code from test target repos (`termui`, `picbot`, `suppose`) — only scan them.
