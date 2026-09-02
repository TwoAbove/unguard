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
import { redundantConditionalSpread } from "./cross-file/redundant-conditional-spread.ts";
import { noUndefinedClobber } from "./ts/no-undefined-clobber.ts";
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
 * - `finding`: the checker or graph demonstrates the defect, so every report
 *   demands a fix (or an explicit `@unguard` annotation). These run on
 *   `unguard scan`.
 * - `smell`: the report has a correct alternative reading the analysis cannot
 *   see and needs a human decision. These run on `unguard smell`.
 */
export type RuleTier = "finding" | "smell";

export interface RuleMetadata {
  category: RuleCategory;
  tags: string[];
  tier: RuleTier;
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
  redundantConditionalSpread,
  noUndefinedClobber,
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
  "no-any-cast": { category: "type-evasion", tags: ["safety"], tier: "finding" },
  "no-explicit-any-annotation": { category: "type-evasion", tags: ["safety"], tier: "finding" },
  "no-inline-type-assertion": { category: "type-evasion", tags: ["safety"], tier: "finding" },
  "no-type-assertion": { category: "type-evasion", tags: ["safety"], tier: "finding" },
  "no-ts-ignore": { category: "type-evasion", tags: ["safety"], tier: "finding" },
  "no-ts-expect-error": { category: "type-evasion", tags: ["safety"], tier: "finding" },
  "no-never-cast": { category: "type-evasion", tags: ["safety"], tier: "finding" },
  "no-redundant-cast": { category: "type-evasion", tags: ["type-aware"], tier: "finding" },
  "no-unvalidated-cast": { category: "type-evasion", tags: ["safety", "type-aware"], tier: "finding" },
  "redundant-narrowing-then-cast": { category: "type-evasion", tags: ["type-aware"], tier: "finding" },
  "return-type-widens-via-destructure": { category: "type-evasion", tags: ["type-aware", "safety"], tier: "finding" },
  // Converting `(x): boolean` to a predicate is a design suggestion, not a defect.
  "prefer-type-predicate": { category: "interface-design", tags: ["api", "type-aware"], tier: "smell" },

  "no-optional-property-access": { category: "defensive-code", tags: ["type-aware"], tier: "finding" },
  "no-optional-element-access": { category: "defensive-code", tags: ["type-aware"], tier: "finding" },
  "no-optional-call": { category: "defensive-code", tags: ["type-aware"], tier: "finding" },
  "no-nullish-coalescing": { category: "defensive-code", tags: ["type-aware"], tier: "finding" },
  "no-logical-or-fallback": { category: "defensive-code", tags: ["type-aware"], tier: "finding" },
  "no-null-ternary-normalization": { category: "defensive-code", tags: ["type-aware"], tier: "finding" },
  "no-coalesce-then-guard": { category: "defensive-code", tags: ["readability"], tier: "finding" },
  // Fusing the call's failure mode into a fallback can be a deliberate choice.
  "no-await-coalesce": { category: "defensive-code", tags: ["type-aware"], tier: "smell" },
  "no-non-null-assertion": { category: "defensive-code", tags: ["type-aware"], tier: "finding" },
  "no-double-negation-coercion": { category: "defensive-code", tags: ["readability"], tier: "finding" },
  "no-redundant-existence-guard": { category: "defensive-code", tags: ["type-aware"], tier: "finding" },
  "no-dead-narrowing": { category: "defensive-code", tags: ["type-aware", "safety"], tier: "finding" },
  "redundant-boolean-branch": { category: "defensive-code", tags: ["readability", "type-aware"], tier: "finding" },
  "no-useless-await": { category: "defensive-code", tags: ["readability", "type-aware"], tier: "finding" },
  "no-coalesce-undefined": { category: "defensive-code", tags: ["type-aware"], tier: "finding" },
  "redundant-destructure-default": { category: "defensive-code", tags: ["type-aware"], tier: "finding" },
  // EXPERIMENTAL: fires only with a demand-side certificate — no reachable
  // key-presence observer in the project; external calls, any, JSX, and rest
  // patterns conservatively count as observers.
  "redundant-conditional-spread": { category: "defensive-code", tags: ["type-aware", "cross-file"], tier: "smell" },
  // EXPERIMENTAL: some overwrites deliberately erase (patch/reset semantics).
  "no-undefined-clobber": { category: "defensive-code", tags: ["type-aware", "safety"], tier: "smell" },
  // Roughly half of trivial aliases are deliberate parallel/boundary naming.
  "trivial-type-alias": { category: "interface-design", tags: ["api", "readability"], tier: "smell" },

  "no-error-rewrap": { category: "error-handling", tags: ["safety"], tier: "finding" },
  "no-swallowed-catch": { category: "error-handling", tags: ["safety"], tier: "finding" },

  "duplicate-inline-type-in-params": { category: "cross-file", tags: ["duplicate", "api"], tier: "smell" },
  // The body's coercion demonstrates that the optionality is fake; the fix is mechanical.
  "optional-param-coerced-in-body": { category: "interface-design", tags: ["api"], tier: "finding" },
  // Type-demonstrated divergence between the interface contract and the implementation.
  "no-defaulted-required-port-arg": { category: "interface-design", tags: ["api", "type-aware"], tier: "finding" },
  "duplicate-type-declaration": { category: "cross-file", tags: ["duplicate"], tier: "smell" },
  "duplicate-type-name": { category: "cross-file", tags: ["duplicate"], tier: "smell" },
  "duplicate-function-declaration": { category: "cross-file", tags: ["duplicate"], tier: "smell" },
  "duplicate-function-name": { category: "cross-file", tags: ["duplicate"], tier: "smell" },
  "duplicate-constant-declaration": { category: "cross-file", tags: ["duplicate"], tier: "smell" },
  "optional-arg-always-used": { category: "cross-file", tags: ["api"], tier: "smell" },
  "optional-arg-never-used": { category: "cross-file", tags: ["api"], tier: "smell" },
  "constant-argument": { category: "cross-file", tags: ["api"], tier: "smell" },
  "explicit-null-arg": { category: "cross-file", tags: ["api"], tier: "smell" },

  // Code-splitting and lazy loading are legitimate dynamic imports.
  "no-dynamic-import": { category: "imports", tags: ["safety"], tier: "smell" },

  "near-duplicate-function": { category: "cross-file", tags: ["duplicate"], tier: "smell" },
  "trivial-wrapper": { category: "cross-file", tags: ["duplicate"], tier: "smell" },
  // Convention-driven and reflective usage is invisible to import analysis.
  "unused-export": { category: "cross-file", tags: ["api"], tier: "smell" },
  "duplicate-file": { category: "cross-file", tags: ["duplicate"], tier: "smell" },
  "duplicate-statement-sequence": { category: "cross-file", tags: ["duplicate"], tier: "smell" },
  "dead-overload": { category: "cross-file", tags: ["api", "type-evasion"], tier: "smell" },

  "repeated-literal-property": { category: "interface-design", tags: ["duplicate", "readability"], tier: "smell" },
  "repeated-return-shape": { category: "interface-design", tags: ["duplicate", "readability"], tier: "smell" },
};

export function getRuleMetadata(ruleId: string): RuleMetadata {
  const metadata = ruleMetadata[ruleId];
  if (metadata === undefined) {
    throw new Error(`unguard: rule "${ruleId}" has no metadata entry in src/rules/index.ts`);
  }
  return metadata;
}
