import type { Rule } from "./types.ts";

import { noEmptyCatch } from "./single-file/no-empty-catch.ts";
import { noNonNullAssertion } from "./single-file/no-non-null-assertion.ts";
import { noDoubleNegationCoercion } from "./single-file/no-double-negation-coercion.ts";
import { noTsIgnore } from "./single-file/no-ts-ignore.ts";
import { noNullishCoalescing } from "./single-file/no-nullish-coalescing.ts";
import { noOptionalCall } from "./single-file/no-optional-call.ts";
import { noOptionalPropertyAccess } from "./single-file/no-optional-property-access.ts";
import { noOptionalElementAccess } from "./single-file/no-optional-element-access.ts";
import { noLogicalOrFallback } from "./single-file/no-logical-or-fallback.ts";
import { noNullTernaryNormalization } from "./single-file/no-null-ternary-normalization.ts";
import { noAnyCast } from "./single-file/no-any-cast.ts";
import { noExplicitAnyAnnotation } from "./single-file/no-explicit-any-annotation.ts";
import { noInlineTypeInParams } from "./single-file/no-inline-type-in-params.ts";
import { noTypeAssertion } from "./single-file/no-type-assertion.ts";
import { noRedundantExistenceGuard } from "./single-file/no-redundant-existence-guard.ts";
import { preferDefaultParamValue } from "./single-file/prefer-default-param-value.ts";
import { preferRequiredParamWithGuard } from "./single-file/prefer-required-param-with-guard.ts";
import { duplicateTypeDeclaration } from "./cross-file/duplicate-type-declaration.ts";
import { duplicateFunctionDeclaration } from "./cross-file/duplicate-function-declaration.ts";
import { optionalArgAlwaysUsed } from "./cross-file/optional-arg-always-used.ts";
import { noCatchReturn } from "./single-file/no-catch-return.ts";
import { noErrorRewrap } from "./single-file/no-error-rewrap.ts";
import { explicitNullArg } from "./cross-file/explicit-null-arg.ts";
import { duplicateFunctionName } from "./cross-file/duplicate-function-name.ts";
import { duplicateTypeName } from "./cross-file/duplicate-type-name.ts";
import { noDynamicImport } from "./single-file/no-dynamic-import.ts";

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
  noInlineTypeInParams,
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
  noDynamicImport,
];
