import * as ts from "typescript";

export interface CommentInfo {
  type: "Line" | "Block";
  value: string;
  start: number;
  end: number;
}

const commentCache = new WeakMap<ts.SourceFile, CommentInfo[]>();

/** Collect all comments from a source file. */
export function collectAllComments(sourceFile: ts.SourceFile): CommentInfo[] {
  const cached = commentCache.get(sourceFile);
  if (cached !== undefined) return cached;

  const comments: CommentInfo[] = [];
  const source = sourceFile.getFullText();
  const seen = new Set<number>();

  function addRanges(ranges: ts.CommentRange[] | undefined): void {
    if (!ranges) return;
    for (const r of ranges) {
      if (seen.has(r.pos)) continue;
      seen.add(r.pos);
      const isLine = r.kind === ts.SyntaxKind.SingleLineCommentTrivia;
      comments.push({
        type: isLine ? "Line" : "Block",
        value: source.slice(r.pos + 2, isLine ? r.end : r.end - 2),
        start: r.pos,
        end: r.end,
      });
    }
  }

  function visit(node: ts.Node): void {
    addRanges(ts.getLeadingCommentRanges(source, node.getFullStart()));
    addRanges(ts.getTrailingCommentRanges(source, node.getEnd()));
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);

  commentCache.set(sourceFile, comments);
  return comments;
}
