import * as ts from "typescript";
import type { SemanticServices, TSVisitContext } from "../rules/types.ts";

function hasFlags(flags: number, mask: number): boolean {
  return (flags & mask) !== 0;
}

/**
 * True when `expr` reads an index whose static type omits `undefined` only
 * because `noUncheckedIndexedAccess` is off: element access into a non-tuple
 * array, or any access resolved through an index signature rather than a
 * declared member. The read can produce `undefined` at runtime even though
 * the checker says otherwise, so a guard on it is load-bearing — rules that
 * flag "dead" guards must suppress on these reads.
 */
export function isUncheckedIndexRead(
  expr: ts.Node,
  semantics: SemanticServices,
  compilerOptions: ts.CompilerOptions,
): boolean {
  if (compilerOptions.noUncheckedIndexedAccess === true) return false;

  let cur: ts.Node = expr;
  while (ts.isParenthesizedExpression(cur) || ts.isNonNullExpression(cur)) {
    cur = cur.expression;
  }

  if (ts.isElementAccessExpression(cur)) {
    // A resolved symbol means a declared member (tuple slot in range, known
    // literal key) — the type is honest.
    if (semantics.symbolAtLocation(cur) !== undefined) return false;
    return hasIndexedElementType(semantics.typeAtLocation(cur.expression), semantics);
  }

  if (ts.isPropertyAccessExpression(cur)) {
    // Property resolved through a string index signature has no symbol.
    if (semantics.symbolAtLocation(cur) !== undefined) return false;
    const apparent = semantics.apparentType(semantics.typeAtLocation(cur.expression));
    return apparent.getStringIndexType() !== undefined;
  }

  return false;
}

function hasIndexedElementType(type: ts.Type, semantics: SemanticServices): boolean {
  if (type.isUnion()) return type.types.some((t) => hasIndexedElementType(t, semantics));
  if (semantics.isArrayType(type) || semantics.isTupleType(type)) return true;
  const apparent = semantics.apparentType(type);
  return apparent.getStringIndexType() !== undefined || apparent.getNumberIndexType() !== undefined;
}

/** Type has a callable `then` member anywhere in its union/intersection. */
export function isPromiseLike(type: ts.Type, semantics: SemanticServices): boolean {
  if (hasThenMethod(type, semantics)) return true;
  if (type.isUnion()) return type.types.some((t) => isPromiseLike(t, semantics));
  if (type.isIntersection()) return type.types.some((t) => isPromiseLike(t, semantics));
  return false;
}

function hasThenMethod(type: ts.Type, semantics: SemanticServices): boolean {
  const apparent = semantics.apparentType(type);
  const then = apparent.getProperty("then");
  if (!then) return false;
  const declaration = then.valueDeclaration ?? then.declarations?.[0];
  if (!declaration) return false;
  const thenType = semantics.typeOfSymbolAtLocation(then, declaration);
  return thenType.getCallSignatures().length > 0;
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
  return ts.isIdentifier(node) && node.text === "undefined";
}

/**
 * For binary equality tests like `x === null` or `null == x`, return the
 * identifier side and the literal side. Caller decides whether the literal
 * is meaningful (e.g. a nullish literal). Returns null when neither operand
 * is a bare identifier.
 */
export function splitEqualityOperands(
  test: ts.BinaryExpression,
): { id: ts.Identifier; lit: ts.Expression } | null {
  const { left, right } = test;
  if (ts.isIdentifier(left)) return { id: left, lit: right };
  if (ts.isIdentifier(right)) return { id: right, lit: left };
  return null;
}

/**
 * Function-like signature carriers. Useful for rules that need to introspect
 * params, generics, and return types uniformly across declarations and
 * expressions.
 */
export type SignatureLike =
  | ts.FunctionDeclaration
  | ts.FunctionExpression
  | ts.ArrowFunction
  | ts.MethodDeclaration;

export function asSignatureLike(node: ts.Node): SignatureLike | null {
  if (ts.isFunctionDeclaration(node)) return node;
  if (ts.isFunctionExpression(node)) return node;
  if (ts.isArrowFunction(node)) return node;
  if (ts.isMethodDeclaration(node)) return node;
  return null;
}

export function getFunctionBodyStatements(node: ts.Node): { statements: ts.NodeArray<ts.Statement>; fn: SignatureLike } | null {
  const fn = asSignatureLike(node);
  if (fn === null) return null;
  if (!fn.body || !ts.isBlock(fn.body)) return null;
  if (fn.body.statements.length === 0) return null;
  return { statements: fn.body.statements, fn };
}


/**
 * Resolved signature of a call whose declaration lives in a declaration file
 * (lib/dependency surface), else null. Used to recognize platform calls by
 * declaration origin instead of by name.
 */
export function libDeclaredSignature(call: ts.CallExpression, semantics: SemanticServices): ts.Signature | null {
  const signature = semantics.resolvedSignature(call);
  const declaration = signature?.declaration;
  if (signature === undefined || declaration === undefined) return null;
  if (!declaration.getSourceFile().isDeclarationFile) return null;
  return signature;
}

interface CommentDirectiveInfo {
  pos: number;
  expectError: boolean;
}

/**
 * Reports each parser-collected `@ts-ignore` / `@ts-expect-error` directive
 * of the requested kind. Shared core of `no-ts-ignore` and
 * `no-ts-expect-error`.
 */
export function reportCommentDirectives(node: ts.Node, ctx: TSVisitContext, expectError: boolean): void {
  if (!ts.isSourceFile(node)) return;
  const directives = getCommentDirectives(node);
  if (directives === undefined) return;
  for (const directive of directives) {
    if (directive.expectError !== expectError) continue;
    ctx.reportAtOffset(directive.pos);
  }
}

/**
 * Extracts the parser-collected `@ts-ignore` / `@ts-expect-error` directives
 * from a source file. `commentDirectives` and its `type` enum
 * (`CommentDirectiveType`: ExpectError = 0, Ignore = 1) are internal TS API,
 * hence the defensive extraction — returns undefined if the shape ever changes.
 */
function getCommentDirectives(sourceFile: ts.SourceFile): CommentDirectiveInfo[] | undefined {
  const directives = Reflect.get(sourceFile, "commentDirectives");
  if (!Array.isArray(directives)) return undefined;
  if (!directives.every(isRawCommentDirective)) return undefined;
  return directives.map((directive) => ({
    pos: directive.range.pos,
    expectError: directive.type === 0,
  }));
}

interface RawCommentDirective {
  range: { pos: number };
  type: number;
}

function isRawCommentDirective(value: unknown): value is RawCommentDirective {
  if (typeof value !== "object" || value === null) return false;
  if (!("range" in value) || !("type" in value)) return false;
  if (typeof value.type !== "number") return false;
  const range = value.range;
  if (typeof range !== "object" || range === null) return false;
  if (!("pos" in range)) return false;
  return typeof range.pos === "number";
}

export function isInlineParamType(node: ts.Node): boolean {
  if (!ts.isTypeLiteralNode(node)) return false;
  // ts.Node#parent is declared non-null but is undefined at unparented nodes.
  const parent: ts.Node | undefined = node.parent;
  if (!parent || !ts.isParameter(parent)) return false;
  return parent.type === node;
}
