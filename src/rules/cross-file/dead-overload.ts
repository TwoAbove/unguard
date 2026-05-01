import * as ts from "typescript";
import type { CrossFileRule, Diagnostic, ProjectIndex } from "../types.ts";

type OverloadDeclaration = ts.FunctionDeclaration | ts.MethodDeclaration;

interface OverloadFamily {
  name: string;
  file: string;
  sourceFile: ts.SourceFile;
  overloads: OverloadDeclaration[];
  implementation: OverloadDeclaration;
}

export const deadOverload: CrossFileRule = {
  id: "dead-overload",
  severity: "warning",
  message: "Overload signature has no matching call sites in the project",
  requires: ["files", "callSites", "overloadCallSignatures"],

  analyze(project: ProjectIndex): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];

    for (const [file, { sourceFile }] of project.files) {
      for (const family of collectOverloadFamilies(sourceFile, file)) {
        const matchedOverloads = new Set<OverloadDeclaration>();

        for (const site of project.callSites) {
          const declaration = site.resolvedDeclaration;
          if (declaration === undefined) continue;
          if (family.overloads.includes(declaration as OverloadDeclaration)) {
            matchedOverloads.add(declaration as OverloadDeclaration);
          }
        }

        if (matchedOverloads.size === 0) continue;

        const deadOverloads = family.overloads.filter((overload) => !matchedOverloads.has(overload));
        const liveOverloads = family.overloads.filter((overload) => matchedOverloads.has(overload));

        for (const overload of deadOverloads) {
          diagnostics.push({
            ruleId: this.id,
            severity: this.severity,
            message: buildMessage(family, overload, deadOverloads, liveOverloads),
            file,
            line: lineOf(sourceFile, overload),
            column: 1,
          });
        }
      }
    }

    return diagnostics;
  },
};

function buildMessage(
  family: OverloadFamily,
  overload: OverloadDeclaration,
  deadOverloads: OverloadDeclaration[],
  liveOverloads: OverloadDeclaration[],
): string {
  const base = `Overload signature for "${family.name}" has no matching call sites in the project`;
  if (!shouldMentionCascade(family, overload, deadOverloads, liveOverloads)) {
    return base;
  }
  return `${base}; removing it may let you collapse to the remaining constrained signature and drop implementation casts`;
}

function shouldMentionCascade(
  family: OverloadFamily,
  overload: OverloadDeclaration,
  deadOverloads: OverloadDeclaration[],
  liveOverloads: OverloadDeclaration[],
): boolean {
  if (deadOverloads.length !== 1 || liveOverloads.length !== 1) return false;
  if (deadOverloads[0] !== overload) return false;
  const liveOverload = liveOverloads[0];
  if (liveOverload === undefined) return false;
  if (family.implementation.typeParameters === undefined || liveOverload.typeParameters === undefined) return false;
  const body = family.implementation.body;
  if (body === undefined) return false;

  const implementationTypeParams = family.implementation.typeParameters;
  const liveTypeParams = liveOverload.typeParameters;
  if (implementationTypeParams.length === 0 || implementationTypeParams.length !== liveTypeParams.length) return false;

  const constrainedParams = implementationTypeParams.flatMap((typeParam, index) => {
    const liveTypeParam = liveTypeParams[index];
    if (liveTypeParam === undefined) return [];
    if (typeParam.constraint !== undefined) return [];
    if (liveTypeParam.constraint === undefined) return [];
    return [{
      paramName: typeParam.name.text,
      constraintText: normalizeText(liveTypeParam.constraint.getText(family.sourceFile)),
    }];
  });

  if (constrainedParams.length === 0) return false;

  return constrainedParams.some(({ paramName, constraintText }) =>
    hasIntersectionCast(body, family.sourceFile, paramName, constraintText)
  );
}

function hasIntersectionCast(
  body: ts.Block,
  sourceFile: ts.SourceFile,
  paramName: string,
  constraintText: string,
): boolean {
  let found = false;

  function visit(node: ts.Node): void {
    if (found) return;

    if (ts.isAsExpression(node) || ts.isTypeAssertionExpression(node)) {
      if (isConstraintIntersection(node.type, sourceFile, paramName, constraintText)) {
        found = true;
        return;
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(body);
  return found;
}

function isConstraintIntersection(
  typeNode: ts.TypeNode,
  sourceFile: ts.SourceFile,
  paramName: string,
  constraintText: string,
): boolean {
  const target = unwrapParenthesizedType(typeNode);
  if (!ts.isIntersectionTypeNode(target)) return false;

  let hasParam = false;
  let hasConstraint = false;

  for (const part of target.types) {
    const text = normalizeText(unwrapParenthesizedType(part).getText(sourceFile));
    if (text === paramName) hasParam = true;
    if (text === constraintText) hasConstraint = true;
  }

  return hasParam && hasConstraint;
}

function unwrapParenthesizedType(typeNode: ts.TypeNode): ts.TypeNode {
  let current = typeNode;
  while (ts.isParenthesizedTypeNode(current)) {
    current = current.type;
  }
  return current;
}

function collectOverloadFamilies(sourceFile: ts.SourceFile, file: string): OverloadFamily[] {
  const families: OverloadFamily[] = [];

  collectFromList(sourceFile.statements, sourceFile, file, families);

  function visit(node: ts.Node): void {
    if (ts.isClassDeclaration(node) || ts.isClassExpression(node)) {
      collectFromList(node.members, sourceFile, file, families);
    }
    ts.forEachChild(node, visit);
  }

  ts.forEachChild(sourceFile, visit);
  return families;
}

function collectFromList(
  nodes: ts.NodeArray<ts.Node>,
  sourceFile: ts.SourceFile,
  file: string,
  families: OverloadFamily[],
): void {
  for (let index = 0; index < nodes.length; index++) {
    const current = asOverloadDeclaration(nodes[index]);
    const name = current ? getDeclarationName(current) : null;
    if (current === null || name === null) continue;

    const run: OverloadDeclaration[] = [current];
    let nextIndex = index + 1;
    while (nextIndex < nodes.length) {
      const next = asOverloadDeclaration(nodes[nextIndex]);
      if (next === null) break;
      if (getDeclarationName(next) !== name) break;
      run.push(next);
      nextIndex++;
    }

    const family = toOverloadFamily(run, name, file, sourceFile);
    if (family !== null) {
      families.push(family);
    }

    index = nextIndex - 1;
  }
}

function toOverloadFamily(
  run: OverloadDeclaration[],
  name: string,
  file: string,
  sourceFile: ts.SourceFile,
): OverloadFamily | null {
  if (run.length < 2) return null;

  const implementation = run.at(-1);
  if (implementation === undefined || implementation.body === undefined) return null;
  if (run.slice(0, -1).some((declaration) => declaration.body !== undefined)) return null;

  return {
    name,
    file,
    sourceFile,
    overloads: run.slice(0, -1),
    implementation,
  };
}

function asOverloadDeclaration(node: ts.Node | undefined): OverloadDeclaration | null {
  if (node === undefined) return null;
  if (ts.isFunctionDeclaration(node)) return node;
  if (ts.isMethodDeclaration(node)) return node;
  return null;
}

function getDeclarationName(node: OverloadDeclaration): string | null {
  if (ts.isFunctionDeclaration(node)) {
    return node.name?.text ?? null;
  }

  if (ts.isIdentifier(node.name) || ts.isStringLiteral(node.name) || ts.isNumericLiteral(node.name)) {
    return node.name.text;
  }

  return null;
}

function lineOf(sourceFile: ts.SourceFile, node: ts.Node): number {
  return ts.getLineAndCharacterOfPosition(sourceFile, node.getStart(sourceFile)).line + 1;
}

function normalizeText(text: string): string {
  return text.replace(/\s+/g, "");
}
