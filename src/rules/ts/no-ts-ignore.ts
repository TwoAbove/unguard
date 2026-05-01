import * as ts from "typescript";
import type { TSRule, TSVisitContext } from "../types.ts";

export const noTsIgnore: TSRule = {
  kind: "ts",
  id: "no-ts-ignore",
  severity: "error",
  message: "@ts-ignore / @ts-expect-error suppresses type checking; fix the underlying type issue",
  syntaxKinds: [ts.SyntaxKind.SourceFile],
  requiresTypeInfo: false,

  visit(node: ts.Node, ctx: TSVisitContext) {
    if (!ts.isSourceFile(node)) return;

    const directives = getCommentDirectives(node);
    if (directives === undefined) return;
    for (const directive of directives) {
      ctx.reportAtOffset(directive.range.pos);
    }
  },
};

interface CommentDirective {
  range: { pos: number };
}

function getCommentDirectives(sourceFile: ts.SourceFile): CommentDirective[] | undefined {
  const directives = Reflect.get(sourceFile, "commentDirectives");
  if (!Array.isArray(directives)) return undefined;
  if (!directives.every(isCommentDirective)) return undefined;
  return directives;
}

function isCommentDirective(value: unknown): value is CommentDirective {
  if (typeof value !== "object" || value === null) return false;
  if (!("range" in value)) return false;
  const range = value.range;
  if (typeof range !== "object" || range === null) return false;
  if (!("pos" in range)) return false;
  return typeof range.pos === "number";
}
