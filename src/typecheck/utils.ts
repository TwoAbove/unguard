import * as ts from "typescript";

function hasFlags(flags: number, mask: number): boolean {
  return (flags & mask) !== 0;
}

const NULLISH_FLAGS = ts.TypeFlags.Null | ts.TypeFlags.Undefined | ts.TypeFlags.Void;

export function isNullableType(checker: ts.TypeChecker, type: ts.Type): boolean {
  if (type.isUnion()) {
    return type.types.some((t) => hasFlags(t.flags, NULLISH_FLAGS));
  }
  return hasFlags(type.flags, NULLISH_FLAGS);
}

export function isFromNodeModules(node: ts.Node): boolean {
  const sourceFile = node.getSourceFile();
  return sourceFile.fileName.includes("/node_modules/");
}

export function includesNumberType(type: ts.Type): boolean {
  if (type.isUnion()) {
    return type.types.some((t) => hasFlags(t.flags, ts.TypeFlags.NumberLike));
  }
  return hasFlags(type.flags, ts.TypeFlags.NumberLike);
}

export function includesBooleanType(type: ts.Type): boolean {
  if (type.isUnion()) {
    return type.types.some((t) => hasFlags(t.flags, ts.TypeFlags.BooleanLike));
  }
  return hasFlags(type.flags, ts.TypeFlags.BooleanLike);
}

export function isNullishLiteral(node: ts.Node): boolean {
  if (node.kind === ts.SyntaxKind.NullKeyword) return true;
  if (ts.isIdentifier(node) && node.text === "undefined") return true;
  return false;
}

type FunctionLike = ts.FunctionDeclaration | ts.ArrowFunction;

export function getFunctionBodyStatements(node: ts.Node): { statements: ts.NodeArray<ts.Statement>; fn: FunctionLike } | null {
  if (!ts.isFunctionDeclaration(node) && !ts.isArrowFunction(node)) return null;
  if (!node.body || !ts.isBlock(node.body)) return null;
  if (node.body.statements.length === 0) return null;
  return { statements: node.body.statements, fn: node };
}
