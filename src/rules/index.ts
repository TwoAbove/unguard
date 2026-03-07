import type { Rule } from "./types.ts";

import { noEmptyCatch } from "./ts/no-empty-catch.ts";
import { noNonNullAssertion } from "./ts/no-non-null-assertion.ts";
import { noDoubleNegationCoercion } from "./ts/no-double-negation-coercion.ts";
import { noTsIgnore } from "./ts/no-ts-ignore.ts";
import { noNullishCoalescing } from "./ts/no-nullish-coalescing.ts";
import { noOptionalCall } from "./ts/no-optional-call.ts";
import { noOptionalPropertyAccess } from "./ts/no-optional-property-access.ts";
import { noOptionalElementAccess } from "./ts/no-optional-element-access.ts";
import { noLogicalOrFallback } from "./ts/no-logical-or-fallback.ts";
import { noNullTernaryNormalization } from "./ts/no-null-ternary-normalization.ts";
import { noAnyCast } from "./ts/no-any-cast.ts";
import { noExplicitAnyAnnotation } from "./ts/no-explicit-any-annotation.ts";
import { duplicateInlineTypeInParams } from "./cross-file/duplicate-inline-type-in-params.ts";
import { noInlineTypeAssertion } from "./ts/no-inline-type-assertion.ts";
import { noTypeAssertion } from "./ts/no-type-assertion.ts";
import { noRedundantExistenceGuard } from "./ts/no-redundant-existence-guard.ts";
import { preferDefaultParamValue } from "./ts/prefer-default-param-value.ts";
import { preferRequiredParamWithGuard } from "./ts/prefer-required-param-with-guard.ts";
import { duplicateTypeDeclaration } from "./cross-file/duplicate-type-declaration.ts";
import { duplicateFunctionDeclaration } from "./cross-file/duplicate-function-declaration.ts";
import { optionalArgAlwaysUsed } from "./cross-file/optional-arg-always-used.ts";
import { noCatchReturn } from "./ts/no-catch-return.ts";
import { noErrorRewrap } from "./ts/no-error-rewrap.ts";
import { explicitNullArg } from "./cross-file/explicit-null-arg.ts";
import { duplicateFunctionName } from "./cross-file/duplicate-function-name.ts";
import { duplicateTypeName } from "./cross-file/duplicate-type-name.ts";
import { duplicateConstantDeclaration } from "./cross-file/duplicate-constant-declaration.ts";
import { noDynamicImport } from "./ts/no-dynamic-import.ts";
import { nearDuplicateFunction } from "./cross-file/near-duplicate-function.ts";
import { trivialWrapper } from "./cross-file/trivial-wrapper.ts";
import { unusedExport } from "./cross-file/unused-export.ts";
import { duplicateFile } from "./cross-file/duplicate-file.ts";
import { duplicateStatementSequence } from "./cross-file/duplicate-statement-sequence.ts";
import { deadOverload } from "./cross-file/dead-overload.ts";

export type RuleCategory =
  | "type-evasion"
  | "defensive-code"
  | "error-handling"
  | "interface-design"
  | "cross-file"
  | "imports";

export interface RuleMetadata {
  category: RuleCategory;
  tags: string[];
}

export const allRules: Rule[] = [
  noEmptyCatch,
  noNonNullAssertion,
  noDoubleNegationCoercion,
  noTsIgnore,
  noNullishCoalescing,
  noOptionalCall,
  noOptionalPropertyAccess,
  noOptionalElementAccess,
  noLogicalOrFallback,
  noNullTernaryNormalization,
  noAnyCast,
  noExplicitAnyAnnotation,
  duplicateInlineTypeInParams,
  noInlineTypeAssertion,
  noTypeAssertion,
  noRedundantExistenceGuard,
  preferDefaultParamValue,
  preferRequiredParamWithGuard,
  duplicateTypeDeclaration,
  duplicateFunctionDeclaration,
  optionalArgAlwaysUsed,
  noCatchReturn,
  noErrorRewrap,
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
];

const ruleMetadata: Record<string, RuleMetadata> = {
  "no-any-cast": { category: "type-evasion", tags: ["safety"] },
  "no-explicit-any-annotation": { category: "type-evasion", tags: ["safety"] },
  "no-inline-type-assertion": { category: "type-evasion", tags: ["safety"] },
  "no-type-assertion": { category: "type-evasion", tags: ["safety"] },
  "no-ts-ignore": { category: "type-evasion", tags: ["safety"] },

  "no-optional-property-access": { category: "defensive-code", tags: ["type-aware"] },
  "no-optional-element-access": { category: "defensive-code", tags: ["type-aware"] },
  "no-optional-call": { category: "defensive-code", tags: ["type-aware"] },
  "no-nullish-coalescing": { category: "defensive-code", tags: ["type-aware"] },
  "no-logical-or-fallback": { category: "defensive-code", tags: ["type-aware"] },
  "no-null-ternary-normalization": { category: "defensive-code", tags: ["type-aware"] },
  "no-non-null-assertion": { category: "defensive-code", tags: ["type-aware"] },
  "no-double-negation-coercion": { category: "defensive-code", tags: ["readability"] },
  "no-redundant-existence-guard": { category: "defensive-code", tags: ["type-aware"] },

  "no-empty-catch": { category: "error-handling", tags: ["safety"] },
  "no-catch-return": { category: "error-handling", tags: ["safety"] },
  "no-error-rewrap": { category: "error-handling", tags: ["safety"] },

  "duplicate-inline-type-in-params": { category: "cross-file", tags: ["duplicate", "api"] },
  "prefer-default-param-value": { category: "interface-design", tags: ["api"] },
  "prefer-required-param-with-guard": { category: "interface-design", tags: ["api"] },

  "duplicate-type-declaration": { category: "cross-file", tags: ["duplicate"] },
  "duplicate-type-name": { category: "cross-file", tags: ["duplicate"] },
  "duplicate-function-declaration": { category: "cross-file", tags: ["duplicate"] },
  "duplicate-function-name": { category: "cross-file", tags: ["duplicate"] },
  "duplicate-constant-declaration": { category: "cross-file", tags: ["duplicate"] },
  "optional-arg-always-used": { category: "cross-file", tags: ["api"] },
  "explicit-null-arg": { category: "cross-file", tags: ["api"] },

  "no-dynamic-import": { category: "imports", tags: ["safety"] },

  "near-duplicate-function": { category: "cross-file", tags: ["duplicate"] },
  "trivial-wrapper": { category: "cross-file", tags: ["duplicate"] },
  "unused-export": { category: "cross-file", tags: ["api"] },
  "duplicate-file": { category: "cross-file", tags: ["duplicate"] },
  "duplicate-statement-sequence": { category: "cross-file", tags: ["duplicate"] },
  "dead-overload": { category: "cross-file", tags: ["api", "type-evasion"] },
};

export function getRuleMetadata(ruleId: string): RuleMetadata {
  const metadata = ruleMetadata[ruleId];
  if (metadata !== undefined) return metadata;
  return { category: "cross-file", tags: [] };
}
