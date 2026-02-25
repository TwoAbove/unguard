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
import { noInlineTypeInParams } from "./ts/no-inline-type-in-params.ts";
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
import { noDynamicImport } from "./ts/no-dynamic-import.ts";

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
