import * as ts from "typescript";
import type { TSRule, TSVisitContext } from "../types.ts";
import { reportCommentDirectives } from "../../typecheck/utils.ts";

export const noTsIgnore: TSRule = {
  kind: "ts",
  id: "no-ts-ignore",
  severity: "error",
  message:
    "@ts-ignore silently suppresses type checking and keeps suppressing after the error is gone; fix the underlying type issue",
  syntaxKinds: [ts.SyntaxKind.SourceFile],
  requiresTypeInfo: false,

  visit(node: ts.Node, ctx: TSVisitContext) {
    reportCommentDirectives(node, ctx, false);
  },
};
