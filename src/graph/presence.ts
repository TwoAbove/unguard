import * as ts from "typescript";
import type { SemanticServices } from "../rules/types.ts";
import { includesUndefined, isFromNodeModules } from "../typecheck/utils.ts";
import { nodeId, type GraphInput } from "./graph.ts";
import type { PresenceFacts } from "./types.ts";

/**
 * Demand-side presence analysis.
 *
 * `{}` and `{ key: undefined }` differ only through key-presence observers:
 * `in`, `for...in`, rest patterns, later-operand spread merges, and any escape
 * into code we cannot see (external calls, `any`, JSX). This collector records
 * three fact kinds, all keyed by *type identity* — the source location of a
 * type's declaration, which is stable across tsconfig groups and needs no
 * name matching:
 *
 * - sites: conditional spreads that launder `undefined` into key absence
 *   (`...(x === undefined ? {} : { x })`) where the direct property would
 *   compile — the compiler-forced and merge-protecting shapes are excluded
 *   here, at collect time.
 * - observed: (typeId, key) pairs some code observes presence of; `"*"`
 *   marks every key of the type.
 * - edges: typeId -> typeId flow (assignments, arguments, returns, casts,
 *   spreads into literals) so an observation downstream silences upstream
 *   sites.
 *
 * The consuming rule fires a site only when no observation is reachable:
 * silence is conservative, a finding is a certificate.
 */

/** Walk every project file once and collect the presence facts. Requires the checker. */
export function buildPresence(input: GraphInput): PresenceFacts {
  const { semantics, compilerOptions } = input;
  if (semantics === undefined || compilerOptions === undefined) {
    throw new Error("buildPresence needs type information.");
  }
  const presence: PresenceFacts = { sites: [], observed: new Map(), edges: new Map() };
  for (const sourceFile of input.sourceFiles) {
    const file = sourceFile.fileName;
    const visit = (node: ts.Node): void => {
      collectPresence(node, file, sourceFile, semantics, compilerOptions, presence);
      ts.forEachChild(node, visit);
    };
    visit(sourceFile);
  }
  return presence;
}

function collectPresence(
  node: ts.Node,
  file: string,
  sourceFile: ts.SourceFile,
  semantics: SemanticServices,
  compilerOptions: ts.CompilerOptions,
  presence: PresenceFacts,
): void {
  switch (node.kind) {
    case ts.SyntaxKind.SpreadAssignment:
      handleObjectSpread(node as ts.SpreadAssignment, file, sourceFile, semantics, compilerOptions, presence);
      return;
    case ts.SyntaxKind.JsxSpreadAttribute: {
      // Props escape into the framework; React's shallowEqual reads Object.keys.
      const spreadExpr = (node as ts.JsxSpreadAttribute).expression;
      observeEscape(semantics.typeAtLocation(spreadExpr), spreadExpr, semantics, presence);
      return;
    }
    case ts.SyntaxKind.BinaryExpression:
      handleBinary(node as ts.BinaryExpression, semantics, presence);
      return;
    case ts.SyntaxKind.ForInStatement:
      observeExpr((node as ts.ForInStatement).expression, "*", semantics, presence);
      return;
    case ts.SyntaxKind.CallExpression:
    case ts.SyntaxKind.NewExpression:
      handleCall(node as ts.CallExpression | ts.NewExpression, semantics, presence);
      return;
    case ts.SyntaxKind.VariableDeclaration:
      handleVariableDeclaration(node as ts.VariableDeclaration, semantics, presence);
      return;
    case ts.SyntaxKind.Parameter:
      handleParameter(node as ts.ParameterDeclaration, semantics, presence);
      return;
    case ts.SyntaxKind.ReturnStatement:
      handleReturn(node as ts.ReturnStatement, semantics, presence);
      return;
    case ts.SyntaxKind.AsExpression:
    case ts.SyntaxKind.SatisfiesExpression:
      handleCast(node as ts.AsExpression | ts.SatisfiesExpression, semantics, presence);
      return;
    case ts.SyntaxKind.PropertySignature:
    case ts.SyntaxKind.PropertyDeclaration:
    case ts.SyntaxKind.IndexSignature:
      handleMember(node as ts.PropertySignature | ts.PropertyDeclaration | ts.IndexSignatureDeclaration, semantics, presence);
      return;
    case ts.SyntaxKind.PropertyAssignment:
    case ts.SyntaxKind.ShorthandPropertyAssignment:
      handlePropertyFlow(node as ts.PropertyAssignment | ts.ShorthandPropertyAssignment, semantics, presence);
      return;
    case ts.SyntaxKind.ArrowFunction:
      handleArrowBody(node as ts.ArrowFunction, semantics, presence);
      return;
  }
}

// ---------------------------------------------------------------------------
// Sites

function handleObjectSpread(
  spread: ts.SpreadAssignment,
  file: string,
  sourceFile: ts.SourceFile,
  semantics: SemanticServices,
  compilerOptions: ts.CompilerOptions,
  presence: PresenceFacts,
): void {
  const laundering = matchLaundering(spread.expression, sourceFile);
  if (laundering !== null) {
    recordSite(spread, laundering.key, file, sourceFile, semantics, compilerOptions, presence);
    return;
  }
  observeMergeOperand(spread, semantics, presence);
  flowIntoLiteral(spread, semantics, presence);
}

function recordSite(
  spread: ts.SpreadAssignment,
  key: string,
  file: string,
  sourceFile: ts.SourceFile,
  semantics: SemanticServices,
  compilerOptions: ts.CompilerOptions,
  presence: PresenceFacts,
): void {
  const literal = spread.parent;
  const contextual = semantics.contextualType(literal);
  if (contextual === undefined) return;

  const prop = contextual.getProperty(key);
  if (prop === undefined) return;
  if ((prop.flags & ts.SymbolFlags.Optional) === 0) return;

  // Mapped-type members are synthesized and may carry no declarations; for
  // those, project ownership is judged from the target type ids below.
  if (prop.declarations?.some(isFromNodeModules)) return;

  // An earlier element already provides the key: the ternary preserves that
  // value against an undefined overwrite. Load-bearing, not laundering.
  if (earlierElementProvidesKey(spread, key, semantics)) return;

  // Under exactOptionalPropertyTypes a strict optional prop rejects an
  // explicit undefined; the compiler forces the guard there.
  if (compilerOptions.exactOptionalPropertyTypes === true) {
    const declared = semantics.typeOfSymbolAtLocation(prop, literal);
    if (!includesUndefined(declared)) return;
  }

  const typeIds = typeIdsOf(contextual);
  if (!typeIds.some(isProjectTypeId)) return;

  const { line, character } = sourceFile.getLineAndCharacterOfPosition(spread.getStart(sourceFile));
  presence.sites.push({
    file,
    line: line + 1,
    column: character + 1,
    key,
    typeIds,
    typeName: semantics.checker.typeToString(contextual),
  });
}

function isProjectTypeId(id: string): boolean {
  return !id.includes("/node_modules/");
}

function earlierElementProvidesKey(
  spread: ts.SpreadAssignment,
  key: string,
  semantics: SemanticServices,
): boolean {
  for (const sibling of spread.parent.properties) {
    if (sibling === spread) break;
    if (ts.isSpreadAssignment(sibling)) {
      if (semantics.typeAtLocation(sibling.expression).getProperty(key) !== undefined) return true;
      continue;
    }
    const name = elementName(sibling);
    if (name === key) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Observations

/** `{ ...earlier, ...operand }`: presence of keys `earlier` also provides decides a clobber. */
function observeMergeOperand(
  spread: ts.SpreadAssignment,
  semantics: SemanticServices,
  presence: PresenceFacts,
): void {
  const earlierKeys = new Set<string>();
  for (const sibling of spread.parent.properties) {
    if (sibling === spread) break;
    if (ts.isSpreadAssignment(sibling)) {
      for (const prop of semantics.typeAtLocation(sibling.expression).getProperties()) {
        earlierKeys.add(prop.name);
      }
      continue;
    }
    const name = elementName(sibling);
    if (name !== undefined) earlierKeys.add(name);
  }
  if (earlierKeys.size === 0) return;

  const spreadType = semantics.typeAtLocation(spread.expression);
  for (const prop of spreadType.getProperties()) {
    if (earlierKeys.has(prop.name)) observeType(spreadType, prop.name, presence);
  }
}

/** A plain spread carries key presence into the containing literal's type. */
function flowIntoLiteral(
  spread: ts.SpreadAssignment,
  semantics: SemanticServices,
  presence: PresenceFacts,
): void {
  const targets = new Set<string>();
  collectLiteralTypeIds(spread.parent, targets, semantics);

  const sourceType = semantics.typeAtLocation(spread.expression);
  if (targets.size === 0) {
    observeEscape(sourceType, spread.expression, semantics, presence);
    return;
  }
  for (const from of typeIdsOf(sourceType)) {
    for (const to of targets) addEdge(presence, from, to);
  }
}

function collectLiteralTypeIds(
  literal: ts.ObjectLiteralExpression,
  targets: Set<string>,
  semantics: SemanticServices,
): void {
  collectTypeIds(semantics.typeAtLocation(literal), targets, 0);
  const contextual = semantics.contextualType(literal);
  if (contextual !== undefined) collectTypeIds(contextual, targets, 0);
}

function handleBinary(node: ts.BinaryExpression, semantics: SemanticServices, presence: PresenceFacts): void {
  const op = node.operatorToken.kind;
  if (op === ts.SyntaxKind.InKeyword) {
    const key = ts.isStringLiteralLike(node.left) ? node.left.text : "*";
    observeExpr(node.right, key, semantics, presence);
    return;
  }
  if (op === ts.SyntaxKind.EqualsToken) {
    edgeTypes(semantics.typeAtLocation(node.right), semantics.typeAtLocation(node.left), node, semantics, presence);
  }
}

function handleCall(
  call: ts.CallExpression | ts.NewExpression,
  semantics: SemanticServices,
  presence: PresenceFacts,
): void {
  const args = call.arguments === undefined ? [] : [...call.arguments];
  const impl = analyzableCallee(call, semantics);

  if (impl === undefined) {
    // We cannot see what the callee does with its arguments — or, for an
    // external method, with its receiver. Everything reachable escapes.
    for (const arg of args) {
      const expr = ts.isSpreadElement(arg) ? arg.expression : arg;
      observeEscape(semantics.typeAtLocation(expr), expr, semantics, presence);
    }
    if (ts.isPropertyAccessExpression(call.expression) || ts.isElementAccessExpression(call.expression)) {
      const receiver = call.expression.expression;
      observeEscape(semantics.typeAtLocation(receiver), receiver, semantics, presence);
    }
    return;
  }

  const params = impl.parameters;
  for (const [i, arg] of args.entries()) {
    if (ts.isSpreadElement(arg)) {
      observeEscape(semantics.typeAtLocation(arg.expression), arg.expression, semantics, presence);
      continue;
    }
    const param = i < params.length ? params[i] : undefined;
    if (param === undefined) continue;
    if (param.dotDotDotToken !== undefined) {
      observeEscape(semantics.typeAtLocation(arg), arg, semantics, presence);
      continue;
    }
    const target = param.type !== undefined
      ? semantics.typeFromTypeNode(param.type)
      : semantics.typeAtLocation(param);
    edgeTypes(semantics.typeAtLocation(arg), target, call, semantics, presence);
  }
}

/** The in-project callee implementation whose body the walk analyzes; undefined = opaque. */
function analyzableCallee(
  call: ts.CallExpression | ts.NewExpression,
  semantics: SemanticServices,
): ts.FunctionLikeDeclaration | undefined {
  const signature = semantics.resolvedSignature(call);
  if (signature === undefined) return undefined;
  const declaration = signature.declaration;
  if (declaration === undefined) return undefined;
  if (isFromNodeModules(declaration)) return undefined;
  if (!ts.isFunctionLike(declaration) || !("body" in declaration)) return undefined;
  if (declaration.body === undefined) return undefined;
  return declaration;
}

function handleVariableDeclaration(
  node: ts.VariableDeclaration,
  semantics: SemanticServices,
  presence: PresenceFacts,
): void {
  if (hasRestElement(node.name)) {
    if (node.initializer !== undefined) {
      observeEscape(semantics.typeAtLocation(node.initializer), node, semantics, presence);
    } else if (node.type !== undefined) {
      observeEscape(semantics.typeFromTypeNode(node.type), node, semantics, presence);
    }
  }
  if (node.type !== undefined && node.initializer !== undefined) {
    edgeTypes(semantics.typeAtLocation(node.initializer), semantics.typeFromTypeNode(node.type), node, semantics, presence);
  }
}

function handleParameter(node: ts.ParameterDeclaration, semantics: SemanticServices, presence: PresenceFacts): void {
  if (!hasRestElement(node.name)) return;
  observeEscape(semantics.typeAtLocation(node), node, semantics, presence);
}

function handleReturn(node: ts.ReturnStatement, semantics: SemanticServices, presence: PresenceFacts): void {
  if (node.expression === undefined) return;
  const fn = enclosingFunction(node);
  if (fn === undefined || fn.type === undefined) return;
  flowReturnExpression(node.expression, fn.type, node, semantics, presence);
}

function handleCast(
  node: ts.AsExpression | ts.SatisfiesExpression,
  semantics: SemanticServices,
  presence: PresenceFacts,
): void {
  edgeTypes(semantics.typeAtLocation(node.expression), semantics.typeFromTypeNode(node.type), node, semantics, presence);
}

/**
 * Containment: a member's keys travel with every value of its container, and
 * recursive consumers (serializers, canonical hashers) observe nested levels
 * too. The edge `memberType -> containerType` lets a site on the member reach
 * observations of anything the container flows into.
 */
function handleMember(
  node: ts.PropertySignature | ts.PropertyDeclaration | ts.IndexSignatureDeclaration,
  semantics: SemanticServices,
  presence: PresenceFacts,
): void {
  if (node.type === undefined) return;
  const containerIds = typeIdsOf(semantics.typeAtLocation(node.parent));
  if (containerIds.length === 0) return;
  for (const from of memberTypeIds(semantics.typeFromTypeNode(node.type), semantics)) {
    for (const to of containerIds) addEdge(presence, from, to);
  }
}

/**
 * `{ slot: value }`: the value flows into the slot's contextual type and the
 * containing literal's types. Literal-valued slots are skipped before any
 * checker work — they carry no project object types.
 */
function handlePropertyFlow(
  node: ts.PropertyAssignment | ts.ShorthandPropertyAssignment,
  semantics: SemanticServices,
  presence: PresenceFacts,
): void {
  const value = ts.isPropertyAssignment(node) ? node.initializer : node.name;
  if (isInertValueSyntax(value)) return;

  const targets = new Set<string>();
  const slot = semantics.contextualType(value);
  if (slot !== undefined) {
    for (const id of typeIdsOf(slot)) targets.add(id);
  }
  collectLiteralTypeIds(node.parent, targets, semantics);
  if (targets.size === 0) return;

  for (const from of memberTypeIds(semantics.typeAtLocation(value), semantics)) {
    for (const to of targets) {
      addEdge(presence, from, to);
    }
  }
}

/** Syntax that cannot carry a project object type; skip before checker work. */
function isInertValueSyntax(expr: ts.Expression): boolean {
  switch (expr.kind) {
    case ts.SyntaxKind.StringLiteral:
    case ts.SyntaxKind.NumericLiteral:
    case ts.SyntaxKind.BigIntLiteral:
    case ts.SyntaxKind.TemplateExpression:
    case ts.SyntaxKind.NoSubstitutionTemplateLiteral:
    case ts.SyntaxKind.TrueKeyword:
    case ts.SyntaxKind.FalseKeyword:
    case ts.SyntaxKind.NullKeyword:
      return true;
    default:
      return false;
  }
}

/** Member type ids, looking through unions, arrays, records, and promises. */
function memberTypeIds(type: ts.Type, semantics: SemanticServices): string[] {
  const out = new Set<string>();

  function visit(current: ts.Type, depth: number): void {
    if (depth > 3) return;
    if (current.isUnion() || current.isIntersection()) {
      for (const constituent of current.types) visit(constituent, depth);
      return;
    }
    addSymbolId(current.aliasSymbol, out);
    addSymbolId(current.getSymbol(), out);
    if ((current.flags & ts.TypeFlags.Object) === 0) return;
    if (((current as ts.ObjectType).objectFlags & ts.ObjectFlags.Reference) !== 0) {
      for (const argument of semantics.checker.getTypeArguments(current as ts.TypeReference)) {
        visit(argument, depth + 1);
      }
    }
    const stringIndex = semantics.checker.getIndexTypeOfType(current, ts.IndexKind.String);
    if (stringIndex !== undefined) visit(stringIndex, depth + 1);
    const numberIndex = semantics.checker.getIndexTypeOfType(current, ts.IndexKind.Number);
    if (numberIndex !== undefined) visit(numberIndex, depth + 1);
  }

  visit(type, 0);
  return [...out];
}

/** `(): X => expr` has no ReturnStatement; flow the body into the annotation. */
function handleArrowBody(node: ts.ArrowFunction, semantics: SemanticServices, presence: PresenceFacts): void {
  if (node.type === undefined) return;
  if (ts.isBlock(node.body)) return;
  flowReturnExpression(node.body, node.type, node, semantics, presence);
}

function flowReturnExpression(
  expression: ts.Expression,
  annotation: ts.TypeNode,
  at: ts.Node,
  semantics: SemanticServices,
  presence: PresenceFacts,
): void {
  const declared = semantics.typeFromTypeNode(annotation);
  const exprType = semantics.typeAtLocation(expression);
  edgeTypes(exprType, declared, at, semantics, presence);
  const awaited = semantics.awaitedType(declared);
  if (awaited !== undefined) edgeTypes(exprType, awaited, at, semantics, presence);
}

// ---------------------------------------------------------------------------
// Fact primitives

function observeExpr(expr: ts.Expression, key: string, semantics: SemanticServices, presence: PresenceFacts): void {
  observeType(semantics.typeAtLocation(expr), key, presence);
}

function observeType(type: ts.Type, key: string, presence: PresenceFacts): void {
  for (const id of typeIdsOf(type)) markObserved(presence, id, key);
}

function markObserved(presence: PresenceFacts, id: string, key: string): void {
  const keys = presence.observed.get(id);
  if (keys === undefined) {
    presence.observed.set(id, new Set([key]));
  } else {
    keys.add(key);
  }
}

/**
 * An escape: the value left analyzable code (external call, `any`, JSX, rest
 * pattern). Everything reachable through its type leaves with it, so mark the
 * type and every nested constituent — type arguments, index-signature values,
 * and properties of project-declared types — as fully observed. Budget-capped;
 * exhausting the budget only loses observations, which errs toward silence
 * for the consuming rule.
 */
function observeEscape(type: ts.Type, at: ts.Node, semantics: SemanticServices, presence: PresenceFacts): void {
  const seen = new Set<string>();
  let budget = 64;

  function walk(current: ts.Type, depth: number): void {
    if (budget <= 0 || depth > 6) return;
    if (current.isUnion() || current.isIntersection()) {
      for (const constituent of current.types) walk(constituent, depth);
      return;
    }

    const ids = new Set<string>();
    addSymbolId(current.aliasSymbol, ids);
    addSymbolId(current.getSymbol(), ids);
    let unseenProject = false;
    let unseen = ids.size === 0;
    for (const id of ids) {
      if (seen.has(id)) continue;
      seen.add(id);
      markObserved(presence, id, "*");
      unseen = true;
      if (isProjectTypeId(id)) unseenProject = true;
    }
    if (!unseen) return;
    budget -= 1;

    // Non-object types (type parameters, primitives) are marked above but
    // have no structure worth traversing.
    if ((current.flags & ts.TypeFlags.Object) === 0) return;

    if (((current as ts.ObjectType).objectFlags & ts.ObjectFlags.Reference) !== 0) {
      for (const argument of semantics.checker.getTypeArguments(current as ts.TypeReference)) {
        walk(argument, depth + 1);
      }
    }
    const stringIndex = semantics.checker.getIndexTypeOfType(current, ts.IndexKind.String);
    if (stringIndex !== undefined) walk(stringIndex, depth + 1);
    const numberIndex = semantics.checker.getIndexTypeOfType(current, ts.IndexKind.Number);
    if (numberIndex !== undefined) walk(numberIndex, depth + 1);

    // Property walks stay inside project-declared types; descending into lib
    // types' members would drown the budget in platform surface.
    if (unseenProject || ids.size === 0) {
      for (const prop of current.getProperties()) {
        if (budget <= 0) return;
        walk(semantics.typeOfSymbolAtLocation(prop, at), depth + 1);
      }
    }
  }

  walk(type, 0);
}

/**
 * Flow presence from `fromType` values into `toType` slots. A flow into
 * `any`/`unknown` is an escape: downstream behavior is unknowable.
 */
function edgeTypes(
  fromType: ts.Type,
  toType: ts.Type,
  at: ts.Node,
  semantics: SemanticServices,
  presence: PresenceFacts,
): void {
  if ((toType.flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown)) !== 0) {
    observeEscape(fromType, at, semantics, presence);
    return;
  }
  const targets = typeIdsOf(toType);
  if (targets.length === 0) return;
  for (const from of typeIdsOf(fromType)) {
    for (const to of targets) addEdge(presence, from, to);
  }
}

function addEdge(presence: PresenceFacts, from: string, to: string): void {
  if (from === to) return;
  const tos = presence.edges.get(from);
  if (tos === undefined) {
    presence.edges.set(from, new Set([to]));
  } else {
    tos.add(to);
  }
}

/**
 * Identity of a type: the source location of its declaration. Works for
 * named and anonymous types alike, is stable across tsconfig groups, and
 * never compares names. Union/intersection constituents are expanded; both
 * the alias symbol and the target symbol contribute so either side of an
 * alias matches.
 */
function typeIdsOf(type: ts.Type): string[] {
  const out = new Set<string>();
  collectTypeIds(type, out, 0);
  return [...out];
}

function collectTypeIds(type: ts.Type, out: Set<string>, depth: number): void {
  if (depth > 3) return;
  if (type.isUnion() || type.isIntersection()) {
    for (const constituent of type.types) collectTypeIds(constituent, out, depth + 1);
    return;
  }
  addSymbolId(type.aliasSymbol, out);
  addSymbolId(type.getSymbol(), out);
}

function addSymbolId(symbol: ts.Symbol | undefined, out: Set<string>): void {
  if (symbol === undefined) return;
  const declarations = symbol.declarations;
  if (declarations === undefined) return;
  const first = declarations[0];
  if (first === undefined) return;
  out.add(nodeId(first, first.getSourceFile()));
}

// ---------------------------------------------------------------------------
// Syntax helpers

function elementName(element: ts.ObjectLiteralElementLike): string | undefined {
  if (ts.isPropertyAssignment(element) || ts.isMethodDeclaration(element)) {
    if (ts.isIdentifier(element.name) || ts.isStringLiteralLike(element.name)) return element.name.text;
    return undefined;
  }
  if (ts.isShorthandPropertyAssignment(element)) return element.name.text;
  return undefined;
}

function hasRestElement(name: ts.BindingName): boolean {
  if (!ts.isObjectBindingPattern(name)) return false;
  return name.elements.some((element) => element.dotDotDotToken !== undefined);
}

function enclosingFunction(node: ts.Node): ts.FunctionLikeDeclaration | undefined {
  let current: ts.Node | undefined = node.parent;
  while (current !== undefined) {
    if (ts.isFunctionLike(current)) return current as ts.FunctionLikeDeclaration;
    current = current.parent;
  }
  return undefined;
}

interface Laundering {
  /** property name being conditionally included */
  key: string;
}

/**
 * Recognize the laundering shape: a ternary whose condition compares an
 * expression against `undefined`, one arm `{}`, the other a single-property
 * object literal forwarding that same expression.
 */
function matchLaundering(expression: ts.Expression, sourceFile: ts.SourceFile): Laundering | null {
  const ternary = unwrapParens(expression);
  if (!ts.isConditionalExpression(ternary)) return null;

  const test = unwrapParens(ternary.condition);
  if (!ts.isBinaryExpression(test)) return null;
  const op = test.operatorToken.kind;
  if (op !== ts.SyntaxKind.EqualsEqualsEqualsToken && op !== ts.SyntaxKind.ExclamationEqualsEqualsToken) {
    return null;
  }

  const subject = undefinedComparisonSubject(test);
  if (subject === null) return null;

  // `=== undefined ? EMPTY : PAYLOAD` / `!== undefined ? PAYLOAD : EMPTY`
  const emptyArm = op === ts.SyntaxKind.EqualsEqualsEqualsToken ? ternary.whenTrue : ternary.whenFalse;
  const payloadArm = op === ts.SyntaxKind.EqualsEqualsEqualsToken ? ternary.whenFalse : ternary.whenTrue;

  const empty = unwrapParens(emptyArm);
  if (!ts.isObjectLiteralExpression(empty) || empty.properties.length > 0) return null;

  const payload = unwrapParens(payloadArm);
  if (!ts.isObjectLiteralExpression(payload) || payload.properties.length !== 1) return null;
  const property = payload.properties[0];
  if (property === undefined) return null;

  const subjectText = normalize(subject.getText(sourceFile));

  if (ts.isShorthandPropertyAssignment(property)) {
    if (normalize(property.name.getText(sourceFile)) !== subjectText) return null;
    return { key: property.name.text };
  }
  if (ts.isPropertyAssignment(property)) {
    if (!ts.isIdentifier(property.name) && !ts.isStringLiteral(property.name)) return null;
    if (normalize(property.initializer.getText(sourceFile)) !== subjectText) return null;
    return { key: property.name.text };
  }
  return null;
}

/** For `x === undefined` / `undefined === x`, return `x`; otherwise null. */
function undefinedComparisonSubject(test: ts.BinaryExpression): ts.Expression | null {
  if (ts.isIdentifier(test.right) && test.right.text === "undefined") return test.left;
  if (ts.isIdentifier(test.left) && test.left.text === "undefined") return test.right;
  return null;
}

function unwrapParens(node: ts.Expression): ts.Expression {
  let current = node;
  while (ts.isParenthesizedExpression(current)) current = current.expression;
  return current;
}

function normalize(text: string): string {
  return text.replace(/\s+/g, "");
}
