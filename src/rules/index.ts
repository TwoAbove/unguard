import type { Rule } from "./types.ts";

import { constantArgument } from "./cross-file/constant-argument.ts";
import { deadOverload } from "./cross-file/dead-overload.ts";
import { duplicateConstantDeclaration } from "./cross-file/duplicate-constant-declaration.ts";
import { duplicateFile } from "./cross-file/duplicate-file.ts";
import { duplicateFunctionDeclaration } from "./cross-file/duplicate-function-declaration.ts";
import { duplicateFunctionName } from "./cross-file/duplicate-function-name.ts";
import { duplicateInlineTypeInParams } from "./cross-file/duplicate-inline-type-in-params.ts";
import { duplicateStatementSequence } from "./cross-file/duplicate-statement-sequence.ts";
import { duplicateTypeDeclaration } from "./cross-file/duplicate-type-declaration.ts";
import { duplicateTypeName } from "./cross-file/duplicate-type-name.ts";
import { explicitNullArg } from "./cross-file/explicit-null-arg.ts";
import { nearDuplicateFunction } from "./cross-file/near-duplicate-function.ts";
import { optionalArgAlwaysUsed } from "./cross-file/optional-arg-always-used.ts";
import { optionalArgNeverUsed } from "./cross-file/optional-arg-never-used.ts";
import { repeatedLiteralProperty } from "./cross-file/repeated-literal-property.ts";
import { repeatedReturnShape } from "./cross-file/repeated-return-shape.ts";
import { trivialWrapper } from "./cross-file/trivial-wrapper.ts";
import { unusedExport } from "./cross-file/unused-export.ts";
import { noAnyCast } from "./ts/no-any-cast.ts";
import { noAwaitCoalesce } from "./ts/no-await-coalesce.ts";
import { noCoalesceThenGuard } from "./ts/no-coalesce-then-guard.ts";
import { noCoalesceUndefined } from "./ts/no-coalesce-undefined.ts";
import { noDeadNarrowing } from "./ts/no-dead-narrowing.ts";
import { noDefaultedRequiredPortArg } from "./ts/no-defaulted-required-port-arg.ts";
import { noDoubleNegationCoercion } from "./ts/no-double-negation-coercion.ts";
import { noDynamicImport } from "./ts/no-dynamic-import.ts";
import { noErrorRewrap } from "./ts/no-error-rewrap.ts";
import { noExplicitAnyAnnotation } from "./ts/no-explicit-any-annotation.ts";
import { noInlineTypeAssertion } from "./ts/no-inline-type-assertion.ts";
import { noNeverCast } from "./ts/no-never-cast.ts";
import { noRedundantCast } from "./ts/no-redundant-cast.ts";
import { noUnvalidatedCast } from "./ts/no-unvalidated-cast.ts";
import { noUselessAwait } from "./ts/no-useless-await.ts";
import { redundantBooleanBranch } from "./ts/redundant-boolean-branch.ts";
import { redundantDestructureDefault } from "./ts/redundant-destructure-default.ts";
import { redundantNarrowingThenCast } from "./ts/redundant-narrowing-then-cast.ts";
import { trivialTypeAlias } from "./ts/trivial-type-alias.ts";
import { returnTypeWidensViaDestructure } from "./ts/return-type-widens-via-destructure.ts";
import { preferTypePredicate } from "./ts/prefer-type-predicate.ts";
import { noLogicalOrFallback } from "./ts/no-logical-or-fallback.ts";
import { noNonNullAssertion } from "./ts/no-non-null-assertion.ts";
import { noSwallowedCatch } from "./ts/no-swallowed-catch.ts";
import { noNullTernaryNormalization } from "./ts/no-null-ternary-normalization.ts";
import { noNullishCoalescing } from "./ts/no-nullish-coalescing.ts";
import { noOptionalCall } from "./ts/no-optional-call.ts";
import { noOptionalElementAccess } from "./ts/no-optional-element-access.ts";
import { noOptionalPropertyAccess } from "./ts/no-optional-property-access.ts";
import { noRedundantExistenceGuard } from "./ts/no-redundant-existence-guard.ts";
import { noTsExpectError } from "./ts/no-ts-expect-error.ts";
import { noTsIgnore } from "./ts/no-ts-ignore.ts";
import { noTypeAssertion } from "./ts/no-type-assertion.ts";
import { optionalParamCoercedInBody } from "./ts/optional-param-coerced-in-body.ts";

export type RuleCategory =
  | "type-evasion"
  | "defensive-code"
  | "error-handling"
  | "interface-design"
  | "cross-file"
  | "imports";

/**
 * The epistemic tier of a rule, orthogonal to severity.
 *
 * - `proven`: the checker or AST demonstrates the defect — the fallback is
 *   dead, the cast evades, the error vanishes. Every finding demands a fix
 *   (or an explicit `@unguard` annotation). These run on `unguard scan`.
 * - `heuristic`: pattern evidence that warrants review — duplication, API
 *   shape, speculative parameters. A finding can have a correct alternative
 *   reading the analysis cannot see (deliberate test explicitness, parallel
 *   naming, convention-driven usage). These run on `unguard audit`.
 *
 * The test for `proven`: would deleting/changing the flagged code ever be
 * wrong when the types are honest? If yes, the rule is heuristic.
 */
export type RuleConfidence = "proven" | "heuristic";

export interface RuleMetadata {
  category: RuleCategory;
  tags: string[];
  confidence: RuleConfidence;
}

export const allRules: Rule[] = [
  noNonNullAssertion,
  noDoubleNegationCoercion,
  noTsIgnore,
  noTsExpectError,
  noNullishCoalescing,
  noOptionalCall,
  noOptionalPropertyAccess,
  noOptionalElementAccess,
  noLogicalOrFallback,
  noNullTernaryNormalization,
  noCoalesceThenGuard,
  noCoalesceUndefined,
  noAwaitCoalesce,
  noDeadNarrowing,
  redundantBooleanBranch,
  noUselessAwait,
  trivialTypeAlias,
  redundantDestructureDefault,
  noAnyCast,
  noExplicitAnyAnnotation,
  duplicateInlineTypeInParams,
  noInlineTypeAssertion,
  noTypeAssertion,
  noNeverCast,
  noRedundantCast,
  noUnvalidatedCast,
  redundantNarrowingThenCast,
  returnTypeWidensViaDestructure,
  preferTypePredicate,
  noRedundantExistenceGuard,
  optionalParamCoercedInBody,
  noDefaultedRequiredPortArg,
  duplicateTypeDeclaration,
  duplicateFunctionDeclaration,
  optionalArgAlwaysUsed,
  optionalArgNeverUsed,
  constantArgument,
  noErrorRewrap,
  noSwallowedCatch,
  explicitNullArg,
  duplicateFunctionName,
  duplicateTypeName,
  duplicateConstantDeclaration,
  noDynamicImport,
  nearDuplicateFunction,
  trivialWrapper,
  unusedExport,
  duplicateFile,
  duplicateStatementSequence,
  deadOverload,
  repeatedLiteralProperty,
  repeatedReturnShape,
];

const ruleMetadata: Record<string, RuleMetadata> = {
  "no-any-cast": { category: "type-evasion", tags: ["safety"], confidence: "proven" },
  "no-explicit-any-annotation": { category: "type-evasion", tags: ["safety"], confidence: "proven" },
  "no-inline-type-assertion": { category: "type-evasion", tags: ["safety"], confidence: "proven" },
  "no-type-assertion": { category: "type-evasion", tags: ["safety"], confidence: "proven" },
  "no-ts-ignore": { category: "type-evasion", tags: ["safety"], confidence: "proven" },
  "no-ts-expect-error": { category: "type-evasion", tags: ["safety"], confidence: "proven" },
  "no-never-cast": { category: "type-evasion", tags: ["safety"], confidence: "proven" },
  "no-redundant-cast": { category: "type-evasion", tags: ["type-aware"], confidence: "proven" },
  "no-unvalidated-cast": { category: "type-evasion", tags: ["safety", "type-aware"], confidence: "proven" },
  "redundant-narrowing-then-cast": { category: "type-evasion", tags: ["type-aware"], confidence: "proven" },
  "return-type-widens-via-destructure": { category: "type-evasion", tags: ["type-aware", "safety"], confidence: "proven" },
  // Converting `(x): boolean` to a predicate is a design suggestion, not a defect.
  "prefer-type-predicate": { category: "interface-design", tags: ["api", "type-aware"], confidence: "heuristic" },

  "no-optional-property-access": { category: "defensive-code", tags: ["type-aware"], confidence: "proven" },
  "no-optional-element-access": { category: "defensive-code", tags: ["type-aware"], confidence: "proven" },
  "no-optional-call": { category: "defensive-code", tags: ["type-aware"], confidence: "proven" },
  "no-nullish-coalescing": { category: "defensive-code", tags: ["type-aware"], confidence: "proven" },
  "no-logical-or-fallback": { category: "defensive-code", tags: ["type-aware"], confidence: "proven" },
  "no-null-ternary-normalization": { category: "defensive-code", tags: ["type-aware"], confidence: "proven" },
  "no-coalesce-then-guard": { category: "defensive-code", tags: ["readability"], confidence: "proven" },
  // Fusing the call's failure mode into a fallback can be a deliberate choice.
  "no-await-coalesce": { category: "defensive-code", tags: ["type-aware"], confidence: "heuristic" },
  "no-non-null-assertion": { category: "defensive-code", tags: ["type-aware"], confidence: "proven" },
  "no-double-negation-coercion": { category: "defensive-code", tags: ["readability"], confidence: "proven" },
  "no-redundant-existence-guard": { category: "defensive-code", tags: ["type-aware"], confidence: "proven" },
  "no-dead-narrowing": { category: "defensive-code", tags: ["type-aware", "safety"], confidence: "proven" },
  "redundant-boolean-branch": { category: "defensive-code", tags: ["readability", "type-aware"], confidence: "proven" },
  "no-useless-await": { category: "defensive-code", tags: ["readability", "type-aware"], confidence: "proven" },
  "no-coalesce-undefined": { category: "defensive-code", tags: ["type-aware"], confidence: "proven" },
  "redundant-destructure-default": { category: "defensive-code", tags: ["type-aware"], confidence: "proven" },
  // Roughly half of trivial aliases are deliberate parallel/boundary naming.
  "trivial-type-alias": { category: "interface-design", tags: ["api", "readability"], confidence: "heuristic" },

  "no-error-rewrap": { category: "error-handling", tags: ["safety"], confidence: "proven" },
  "no-swallowed-catch": { category: "error-handling", tags: ["safety"], confidence: "proven" },

  "duplicate-inline-type-in-params": { category: "cross-file", tags: ["duplicate", "api"], confidence: "heuristic" },
  // The body's coercion proves the optionality is fake; the fix is mechanical.
  "optional-param-coerced-in-body": { category: "interface-design", tags: ["api"], confidence: "proven" },
  // Type-proven divergence between the interface contract and the implementation.
  "no-defaulted-required-port-arg": { category: "interface-design", tags: ["api", "type-aware"], confidence: "proven" },
  "duplicate-type-declaration": { category: "cross-file", tags: ["duplicate"], confidence: "heuristic" },
  "duplicate-type-name": { category: "cross-file", tags: ["duplicate"], confidence: "heuristic" },
  "duplicate-function-declaration": { category: "cross-file", tags: ["duplicate"], confidence: "heuristic" },
  "duplicate-function-name": { category: "cross-file", tags: ["duplicate"], confidence: "heuristic" },
  "duplicate-constant-declaration": { category: "cross-file", tags: ["duplicate"], confidence: "heuristic" },
  "optional-arg-always-used": { category: "cross-file", tags: ["api"], confidence: "heuristic" },
  "optional-arg-never-used": { category: "cross-file", tags: ["api"], confidence: "heuristic" },
  "constant-argument": { category: "cross-file", tags: ["api"], confidence: "heuristic" },
  "explicit-null-arg": { category: "cross-file", tags: ["api"], confidence: "heuristic" },

  // Code-splitting and lazy loading are legitimate dynamic imports.
  "no-dynamic-import": { category: "imports", tags: ["safety"], confidence: "heuristic" },

  "near-duplicate-function": { category: "cross-file", tags: ["duplicate"], confidence: "heuristic" },
  "trivial-wrapper": { category: "cross-file", tags: ["duplicate"], confidence: "heuristic" },
  // Convention-driven and reflective usage is invisible to import analysis.
  "unused-export": { category: "cross-file", tags: ["api"], confidence: "heuristic" },
  "duplicate-file": { category: "cross-file", tags: ["duplicate"], confidence: "heuristic" },
  "duplicate-statement-sequence": { category: "cross-file", tags: ["duplicate"], confidence: "heuristic" },
  "dead-overload": { category: "cross-file", tags: ["api", "type-evasion"], confidence: "heuristic" },

  "repeated-literal-property": { category: "interface-design", tags: ["duplicate", "readability"], confidence: "heuristic" },
  "repeated-return-shape": { category: "interface-design", tags: ["duplicate", "readability"], confidence: "heuristic" },
};

export function getRuleMetadata(ruleId: string): RuleMetadata {
  const metadata = ruleMetadata[ruleId];
  if (metadata === undefined) {
    throw new Error(`unguard: rule "${ruleId}" has no metadata entry in src/rules/index.ts`);
  }
  return metadata;
}
