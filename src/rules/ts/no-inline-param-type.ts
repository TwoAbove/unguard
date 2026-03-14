import type * as ts from "typescript";
import type { TSRule, TSVisitContext } from "../types.ts";
import { isInlineParamType } from "../../typecheck/utils.ts";

export const noInlineParamType: TSRule = {
  kind: "ts",
  id: "no-inline-param-type",
  severity: "warning",
  message:
    "Inline object type on parameter; extract to a named type",

  visit(node: ts.Node, ctx: TSVisitContext) {
    if (isInlineParamType(node)) ctx.report(node);
  },
};
