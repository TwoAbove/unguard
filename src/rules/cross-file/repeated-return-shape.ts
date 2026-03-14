import * as ts from "typescript";
import type { CrossFileRule, Diagnostic, ProjectIndex } from "../types.ts";
import { extractPropertyNames, getShapeGroup } from "./object-shape.ts";

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

  analyze(project: ProjectIndex): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    const THRESHOLD = 3;
    const shapeMap = new Map<string, ReturnShapeEntry[]>();

    for (const [file, { sourceFile }] of project.files) {
      function visit(node: ts.Node): void {
        if (isFunctionLike(node)) {
          const functionName = deriveFunctionName(node, sourceFile);
          const line = ts.getLineAndCharacterOfPosition(sourceFile, node.getStart(sourceFile)).line + 1;
          collectReturnShapes(node, file, line, functionName, sourceFile, shapeMap);
        }
        ts.forEachChild(node, visit);
      }
      ts.forEachChild(sourceFile, visit);
    }

    for (const [, entries] of shapeMap) {
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

      const sorted = unique.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);
      for (const entry of sorted) {
        const others = sorted
          .filter((e) => e !== entry)
          .map((e) => `${e.functionName} (${e.file}:${e.line})`)
          .join(", ");
        diagnostics.push({
          ruleId: this.id,
          severity: this.severity,
          message: `${unique.length} functions return shape {${entry.props.join(", ")}}; consider a shared return type (${others})`,
          file: entry.file,
          line: entry.line,
          column: 1,
        });
      }
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
  if (props === null || props.length === 0) return;
  const { sorted, list } = getShapeGroup(shapeMap, props);
  list.push({ file, line: funcLine, functionName, props: sorted });
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
