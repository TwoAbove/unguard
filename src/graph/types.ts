/**
 * The project graph: the one index every cross-file rule reads.
 *
 * Every value that crosses this interface is plain data — no `ts.Node`, no
 * `ts.Symbol`, no `ts.SourceFile`. Identity is a `NodeId`; symbol identity is
 * resolved *inside* the graph and surfaced as matching ids. Facts therefore
 * survive `structuredClone`, so global-fact rules can ship them across the
 * worker boundary unchanged.
 *
 * Families are materialized lazily on first query and cached for the life of
 * the graph. A query that needs the checker throws when the graph was built
 * without one (source-only mode); a rule that asks such a query must leave
 * `requiresTypeInfo` at its default (`true`).
 */

/**
 * `${file}:${start}-${end}` where `start` is `node.getStart(sourceFile)` (the
 * offset of the node's first token, after leading trivia) and `end` is
 * `node.getEnd()`. Both are needed: nested expressions such as `f(x).g()` and
 * `f(x)` share a start. Stable across tsconfig groups because it derives from
 * source text only.
 */
export type NodeId = string;

export interface Site {
  file: string;
  /** 1-based */
  line: number;
  /** 1-based */
  column: number;
  /** `node.getStart(sourceFile)` */
  start: number;
  /** `node.getEnd()` */
  end: number;
}

// ---------------------------------------------------------------------------
// Declarations

export interface ParamFact {
  /** id of the `ParameterDeclaration` node */
  id: NodeId;
  name: string;
  /** `?` marker present */
  optional: boolean;
  /** initializer present */
  hasDefault: boolean;
  /** `...rest` */
  isRest: boolean;
  /** whitespace-normalized type annotation text, or null when unannotated */
  typeText: string | null;
}

export interface FunctionFact {
  kind: "function";
  /**
   * id of the *declaring* node: the `FunctionDeclaration` / `MethodDeclaration`
   * itself; the `VariableDeclaration` for `const f = () => …` / `const f = function …`;
   * the `PropertyAssignment` for `{ key: () => … }`; the arrow / function
   * expression node for anonymous functions.
   */
  id: NodeId;
  /** id of the function-like node whose body is analyzed (equals `id` except for variable/property forms) */
  bodyOwner: NodeId;
  /**
   * Display name, never identity: declared name; `Class.method` for methods;
   * derived name (callee/property context or `<anonymous>:line`) for anonymous
   * functions.
   */
  name: string;
  site: Site;
  exported: boolean;
  exportedAsDefault: boolean;
  params: ParamFact[];
  /** hash of the body with comments/whitespace stripped */
  hash: string;
  /** hash of the body with literals and parameter names normalized */
  normalizedHash: string;
  bodyLength: number;
  normalizedBodyLength: number;
  /** enclosing class name for methods */
  className: string | null;
  /** top-level statements of a block body; 1 for an expression-bodied arrow */
  statementCount: number;
  /** body (including nested functions) contains an if/switch/loop/try statement */
  hasControlFlow: boolean;
  /** block body is exactly one `a = b` expression statement */
  isAssignmentOnly: boolean;
  /** return type annotation is a type predicate (`x is T`) */
  hasTypePredicateReturn: boolean;
  hasTypeParameters: boolean;
  /**
   * When the body is exactly `return callee(args)` or `=> callee(args)`, with
   * no type arguments on the call: the `CallFact.id` of that call. Otherwise null.
   */
  soleCall: NodeId | null;
  /** the function-like node is directly an argument of a call (through parentheses) */
  isCallbackArgument: boolean;
}

export interface TypeFact {
  kind: "type";
  /** id of the `TypeAliasDeclaration` / `InterfaceDeclaration` */
  id: NodeId;
  name: string;
  site: Site;
  exported: boolean;
  /** shape hash (`hashTypeShape`) of the alias target / interface body */
  hash: string;
  form: "interface" | "type-literal" | "other";
  /** members of an interface / type-literal; 0 for `other` */
  memberCount: number;
  /**
   * Static `PropertySignature` names in source order for interfaces and
   * type literals; null when the form is `other` or any property name is
   * computed.
   */
  propertyNames: string[] | null;
}

export interface ConstantFact {
  kind: "constant";
  /** id of the `VariableDeclaration` */
  id: NodeId;
  name: string;
  site: Site;
  exported: boolean;
  /** whitespace-normalized initializer text (display only) */
  valueText: string;
  /** hash of `valueText` */
  hash: string;
}

export interface InlineParamTypeFact {
  /** id of the `TypeLiteralNode` */
  id: NodeId;
  site: Site;
  hash: string;
  /** whitespace-collapsed source text of the literal */
  typeText: string;
}

export interface FileFact {
  file: string;
  /** hash of the whitespace-normalized full text */
  hash: string;
  /** directory of the nearest ancestor `package.json`, or the filesystem root */
  packageRoot: string;
}

export interface ObjectLiteralPropertyFact {
  /** static key (identifier or string literal); "" when computed */
  key: string;
  site: Site;
  /**
   * For `PropertyAssignment` initializers that are a string / no-substitution
   * template literal, optionally wrapped in `as const`: the literal's value.
   * Null otherwise.
   */
  literalText: string | null;
  isAsConst: boolean;
}

export interface ObjectLiteralFact {
  /** id of the `ObjectLiteralExpression` */
  id: NodeId;
  site: Site;
  /**
   * Static property names in source order (property assignments, shorthand
   * assignments, methods); null when any element is a spread or a computed name.
   */
  propertyNames: string[] | null;
  /**
   * "return" when the literal — unwrapped through parentheses and `as` — is
   * the expression of a `return` statement or the expression body of an
   * arrow function, and that statement/arrow belongs directly to
   * `enclosingFunction` (no nested function in between).
   */
  role: "return" | "other";
  /** nearest enclosing function-like node; null at module scope */
  enclosingFunction: {
    /** id of the function-like node itself (arrow / function expression / declaration / method) */
    id: NodeId;
    /** display name derived as for `FunctionFact.name` */
    name: string;
    site: Site;
    isCallbackArgument: boolean;
    /** the nearest function-like node has an explicit return type annotation */
    hasReturnTypeAnnotation: boolean;
  } | null;
  /** `PropertyAssignment` elements only, source order */
  properties: ObjectLiteralPropertyFact[];
}

export interface MaximalMatchParticipant {
  file: string;
  line: number;
  column: number;
  endLine: number;
  statementCount: number;
}

export interface MaximalMatch {
  participants: MaximalMatchParticipant[];
  statementCount: number;
  /** sum of per-statement normalized text lengths across the matched run */
  normalizedBodyLength: number;
}

// ---------------------------------------------------------------------------
// References

export type ArgShape =
  /** string / number (including negative) / boolean / null / intrinsic undefined / no-substitution template; exact source text */
  | { kind: "literal"; text: string }
  | { kind: "spread" }
  /**
   * A bare identifier. `decl` is the id of the declaration it resolves to —
   * a `ParameterDeclaration`, `VariableDeclaration`, function or class
   * declaration in source — or null when unresolved, in a declaration file or node_modules.
   */
  | { kind: "identifier"; decl: NodeId | null }
  | { kind: "other" };

export interface CallFact {
  /** id of the `CallExpression` / `NewExpression` */
  id: NodeId;
  site: Site;
  /**
   * Canonical source declaration id, including source outside this graph's files;
   * overloaded symbols use their body implementation, assigned functions their binding.
   * Null when unresolved or declared in a declaration file or node_modules.
   */
  callee: NodeId | null;
  args: ArgShape[];
  isNew: boolean;
  hasTypeArguments: boolean;
  /**
   * Canonical source signature declaration selected by the checker, including
   * declarations outside this graph's files; null when unavailable or external.
   */
  resolvedSignature: NodeId | null;
}

export interface SignatureFact {
  /** id of the signature declaration node */
  id: NodeId;
  site: Site;
  /** the implementation signature (has a body) */
  hasBody: boolean;
  /** type parameters in order, with whitespace-stripped constraint text or null */
  typeParams: { name: string; constraintText: string | null }[];
}

export interface OverloadFamilyFact {
  /** Canonical declaration identity shared by calls and readers. */
  id: NodeId;
  name: string;
  signatures: SignatureFact[];
}

export type ImportKind =
  | "named"
  | "default"
  | "namespace"
  | "reexport-named"
  | "reexport-star"
  | "side-effect";

export interface ImportFact {
  /** importing module */
  file: string;
  site: Site;
  kind: ImportKind;
  /** the specifier as written */
  source: string;
  /**
   * The specifier resolved to a source file: through the checker when
   * available (path aliases, workspace packages — any non-declaration,
   * non-node_modules file of the program, including files outside this
   * graph's set so cross-group merges can see them), otherwise textually
   * (relative specifiers, graph files only). Null when it resolves to an
   * external module.
   */
  resolvedFile: string | null;
  /** exported name on the source module; "default" for default imports; "*" for namespace / star */
  importedName: string;
  /** local binding name; equals `importedName` for `export { x } from` forms; "*" for star re-exports */
  localName: string;
}

export type ReaderKind =
  /** identifier is the callee of a call / new */
  | "call"
  /** identifier is an argument to a call / new */
  | "argument"
  /** identifier is spread (`...x`) */
  | "spread"
  /** identifier is the subject of `typeof` / `instanceof` / `in` / a discriminant comparison */
  | "narrow"
  /** identifier is the object of a property / element access */
  | "keyed"
  /** identifier appears in a type position (`TypeReference`, `typeof x` type query, heritage clause) */
  | "type-reference"
  /** any other value read */
  | "read";

export interface ReaderFact {
  /** id of the identifier node */
  id: NodeId;
  site: Site;
  kind: ReaderKind;
}

export interface ExportFact {
  /** id of the exported declaration (function / type / constant / class / enum) */
  decl: NodeId;
  /** the declaring module */
  file: string;
  /** exported name; "default" for default exports */
  name: string;
  kind: "function" | "type" | "constant" | "class" | "enum" | "other";
}

// ---------------------------------------------------------------------------
// Presence (undefined-vs-absent)

export interface PresenceSite {
  file: string;
  line: number;
  column: number;
  /** property name whose presence the ternary controls */
  key: string;
  /** identities of the contextual target type (union/intersection expanded) */
  typeIds: string[];
  /** display name for diagnostics only, never identity */
  typeName: string;
}

export interface PresenceFacts {
  sites: PresenceSite[];
  /** typeId -> keys observed on it ("*" = all keys) */
  observed: Map<string, Set<string>>;
  /** typeId -> typeIds its values flow into */
  edges: Map<string, Set<string>>;
}

// ---------------------------------------------------------------------------
// The graph

export type DuplicateKind =
  | "type"
  | "function"
  | "function-normalized"
  | "constant"
  | "inline-param-type"
  | "file";

export interface DuplicateFactOf {
  "type": TypeFact;
  "function": FunctionFact;
  "function-normalized": FunctionFact;
  "constant": ConstantFact;
  "inline-param-type": InlineParamTypeFact;
  "file": FileFact;
}

export interface Graph {
  // Declarations (no checker required)
  functions(): readonly FunctionFact[];
  types(): readonly TypeFact[];
  constants(): readonly ConstantFact[];
  inlineParamTypes(): readonly InlineParamTypeFact[];
  files(): readonly FileFact[];
  objectLiterals(): readonly ObjectLiteralFact[];
  /** groups of size ≥ 2 sharing the kind's hash */
  duplicateGroups<K extends DuplicateKind>(kind: K): DuplicateFactOf[K][][];
  /**
   * Exported functions / types with the same name declared in ≥ 2 files of
   * the same package (same `FileFact.packageRoot`).
   */
  nameCollisions(kind: "function"): FunctionFact[][];
  nameCollisions(kind: "type"): TypeFact[][];
  /** maximal duplicated statement runs (see statement-sequences.ts) */
  duplicateStatementSequences(minStatements: number, minNormalizedBody: number): MaximalMatch[];

  // Modules (checker optional; resolution degrades to textual)
  imports(): readonly ImportFact[];
  /** imports whose `resolvedFile` is `file` */
  importers(file: string): readonly ImportFact[];
  /** every exported declaration, all files */
  exports(): readonly ExportFact[];

  // References (checker required)
  calls(): readonly CallFact[];
  /** calls whose `callee` is `fn` */
  callers(fn: NodeId): readonly CallFact[];
  /** all signature declarations of the function's symbol, source order; length 1 when not overloaded */
  overloads(fn: NodeId): readonly SignatureFact[];
  /** All source function families, including methods outside functions() eligibility. */
  overloadFamilies(): Iterable<OverloadFamilyFact>;
  /** Source callable declarations participating in inherited or implemented member contracts. */
  signatureConstraints(): ReadonlySet<NodeId>;
  /**
   * Every identifier anywhere in the project that resolves (through import
   * aliases) to the canonical declaration `decl`, excluding declaration names and import bindings.
   */
  readers(decl: NodeId): readonly ReaderFact[];

  // Presence (checker required)
  presence(): PresenceFacts;

  /** the project files the graph was built over */
  readonly fileNames: readonly string[];
  /** false in source-only mode */
  readonly hasTypeInfo: boolean;
}
