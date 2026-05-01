import * as ts from "typescript";
import { type CrossFileAnalysisContext, type CrossFileRule, type Diagnostic, type ProjectIndex, selectReportTarget } from "../types.ts";
import { extractPropertyNames, getShapeGroup } from "./object-shape.ts";
import type { TypeEntry } from "../../collect/type-registry.ts";

interface ReturnShapeEntry {
  file: string;
  line: number;
  functionName: string;
  props: string[];
}

export const repeatedReturnShape: CrossFileRule = {
  id: "repeated-return-shape",
  severity: "warning",
  message: "Multiple functions return the same object shape; consider a shared return type",
  requires: ["files", "types"],

  analyze(project: ProjectIndex, context: CrossFileAnalysisContext = {}): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    const THRESHOLD = 3;
    const shapeMap = new Map<string, ReturnShapeEntry[]>();

    for (const [file, { sourceFile }] of project.files) {
      function visit(node: ts.Node): void {
        if (isFunctionLike(node) && !isCallbackArgument(node)) {
          const functionName = deriveFunctionName(node, sourceFile);
          const line = ts.getLineAndCharacterOfPosition(sourceFile, node.getStart(sourceFile)).line + 1;
          collectReturnShapes(node, file, line, functionName, sourceFile, shapeMap);
        }
        ts.forEachChild(node, visit);
      }
      ts.forEachChild(sourceFile, visit);
    }

    const knownTypeShapes = buildKnownTypeShapes(project.types.getAll());

    for (const [shapeKey, entries] of shapeMap) {
      if (knownTypeShapes.has(shapeKey)) continue;
      // Deduplicate: one entry per function (same file + line)
      const byFunction = new Map<string, ReturnShapeEntry>();
      for (const entry of entries) {
        const key = `${entry.file}:${entry.line}`;
        if (!byFunction.has(key)) {
          byFunction.set(key, entry);
        }
      }
      const unique = [...byFunction.values()];
      if (unique.length < THRESHOLD) continue;

      // Same-file repetition is visible and likely intentional (protocol/framework pattern).
      // Only flag shapes that span multiple files — that's where the developer can't see the duplication.
      const uniqueFiles = new Set(unique.map((e) => e.file));
      if (uniqueFiles.size < 2) continue;

      const sorted = unique.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);
      const target = selectReportTarget(sorted, context.reportableFiles);
      if (target === undefined) continue;
      const others = sorted
        .filter((e) => e !== target)
        .map((e) => `${e.functionName} (${e.file}:${e.line})`)
        .join(", ");
      diagnostics.push({
        ruleId: this.id,
        severity: this.severity,
        message: `${unique.length} functions return shape {${target.props.join(", ")}}; consider a shared return type (${others})`,
        file: target.file,
        line: target.line,
        column: 1,
      });
    }

    return diagnostics;
  },
};

function isFunctionLike(node: ts.Node): boolean {
  return (
    ts.isFunctionDeclaration(node) ||
    ts.isFunctionExpression(node) ||
    ts.isArrowFunction(node) ||
    ts.isMethodDeclaration(node)
  );
}

function unwrapExpression(node: ts.Expression): ts.Expression {
  if (ts.isParenthesizedExpression(node)) return unwrapExpression(node.expression);
  if (ts.isAsExpression(node)) return unwrapExpression(node.expression);
  return node;
}

function getBody(node: ts.Node): ts.Block | undefined {
  if (ts.isFunctionDeclaration(node) && node.body) return node.body;
  if (ts.isFunctionExpression(node) && node.body) return node.body;
  if (ts.isArrowFunction(node) && ts.isBlock(node.body)) return node.body;
  if (ts.isMethodDeclaration(node) && node.body) return node.body;
  return undefined;
}

function collectReturnShapes(
  funcNode: ts.Node,
  file: string,
  funcLine: number,
  functionName: string,
  sourceFile: ts.SourceFile,
  shapeMap: Map<string, ReturnShapeEntry[]>,
): void {
  // Arrow function with expression body
  if (ts.isArrowFunction(funcNode) && !ts.isBlock(funcNode.body)) {
    const expr = unwrapExpression(funcNode.body);
    if (ts.isObjectLiteralExpression(expr)) {
      addShape(expr, file, funcLine, functionName, sourceFile, shapeMap);
    }
    return;
  }

  const body = getBody(funcNode);
  if (!body) return;

  function walkForReturns(node: ts.Node): void {
    if (ts.isReturnStatement(node) && node.expression) {
      const expr = unwrapExpression(node.expression);
      if (ts.isObjectLiteralExpression(expr)) {
        addShape(expr, file, funcLine, functionName, sourceFile, shapeMap);
      }
    }
    // Don't recurse into nested function-like nodes
    if (isFunctionLike(node)) return;
    ts.forEachChild(node, walkForReturns);
  }
  ts.forEachChild(body, walkForReturns);
}

function addShape(
  objLiteral: ts.ObjectLiteralExpression,
  file: string,
  funcLine: number,
  functionName: string,
  sourceFile: ts.SourceFile,
  shapeMap: Map<string, ReturnShapeEntry[]>,
): void {
  const props = extractPropertyNames(objLiteral);
  if (props === null || props.length < 2) return;
  const { sorted, list } = getShapeGroup(shapeMap, props);
  list.push({ file, line: funcLine, functionName, props: sorted });
}

function isCallbackArgument(node: ts.Node): boolean {
  let current: ts.Node = node;
  if (ts.isParenthesizedExpression(current.parent)) {
    current = current.parent;
  }
  const parent = current.parent;
  if (!ts.isCallExpression(parent)) return false;
  return parent.arguments.some((arg) => arg === current);
}

function buildKnownTypeShapes(typeEntries: TypeEntry[]): Set<string> {
  const shapes = new Set<string>();
  for (const entry of typeEntries) {
    const props = extractTypePropertyNames(entry.node);
    if (props && props.length >= 2) {
      shapes.add([...props].sort().join("\0"));
    }
  }
  return shapes;
}

function extractTypePropertyNames(node: ts.Node): string[] | null {
  let members: ts.NodeArray<ts.TypeElement> | undefined;
  if (ts.isTypeLiteralNode(node)) {
    members = node.members;
  } else if (ts.isInterfaceDeclaration(node)) {
    members = node.members;
  }
  if (!members) return null;

  const names: string[] = [];
  for (const member of members) {
    if (ts.isPropertySignature(member) && member.name) {
      if (ts.isIdentifier(member.name)) names.push(member.name.text);
      else if (ts.isStringLiteral(member.name)) names.push(member.name.text);
      else return null;
    }
  }
  return names.length > 0 ? names : null;
}

function deriveFunctionName(node: ts.Node, sourceFile: ts.SourceFile): string {
  if (ts.isFunctionDeclaration(node) && node.name) {
    return node.name.text;
  }
  if (ts.isMethodDeclaration(node) && ts.isIdentifier(node.name)) {
    const parent = node.parent;
    if (ts.isClassDeclaration(parent) && parent.name) {
      return `${parent.name.text}.${node.name.text}`;
    }
    return node.name.text;
  }
  const parent = node.parent;
  if (ts.isVariableDeclaration(parent) && ts.isIdentifier(parent.name)) {
    return parent.name.text;
  }
  if (ts.isPropertyAssignment(parent) && ts.isIdentifier(parent.name)) {
    return parent.name.text;
  }
  const line = ts.getLineAndCharacterOfPosition(sourceFile, node.getStart(sourceFile)).line + 1;
  return `<anonymous>:${line}`;
}
