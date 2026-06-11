import * as ts from "typescript";
import type { TSRule, TSVisitContext } from "../types.ts";
import { reportCommentDirectives } from "../../typecheck/utils.ts";

// Warning, not error: unlike @ts-ignore it self-expires (compile error once the
// suppressed error disappears), so it has legitimate uses — testing invalid
// inputs, working around upstream .d.ts bugs. It still hides a real type error.
export const noTsExpectError: TSRule = {
  kind: "ts",
  id: "no-ts-expect-error",
  severity: "warning",
  message:
    "@ts-expect-error suppresses a real type error; fix the underlying type issue",
  syntaxKinds: [ts.SyntaxKind.SourceFile],
  requiresTypeInfo: false,

  visit(node: ts.Node, ctx: TSVisitContext) {
    reportCommentDirectives(node, ctx, true);
  },
};
