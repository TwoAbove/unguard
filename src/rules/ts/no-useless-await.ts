import * as ts from "typescript";
import type { TSRule, TSVisitContext } from "../types.ts";
import { isPromiseLike } from "../../typecheck/utils.ts";

/**
 * `await` on a value whose type has no `then` method is a dead keyword: it
 * adds a microtask hop and tells the reader work is asynchronous when it
 * isn't. Usually left behind after a refactor made a function synchronous.
 */
export const noUselessAwait: TSRule = {
  kind: "ts",
  id: "no-useless-await",
  severity: "warning",
  message: "await on a non-promise value is a no-op; the operand's type has no then method",
  syntaxKinds: [ts.SyntaxKind.AwaitExpression],

  visit(node: ts.Node, ctx: TSVisitContext) {
    if (!ts.isAwaitExpression(node)) return;

    const type = ctx.semantics.typeAtLocation(node.expression);
    if (type.flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown | ts.TypeFlags.Instantiable)) return;
    if (isPromiseLike(type, ctx.semantics)) return;

    ctx.report(node, undefined, {
      start: node.getStart(ctx.sourceFile),
      end: node.getEnd(),
      text: node.expression.getText(ctx.sourceFile),
    });
  },
};
