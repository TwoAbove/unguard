import { parseSync, type Comment } from "oxc-parser";
import { walk } from "oxc-walker";
import { readFileSync } from "node:fs";
import type { Node } from "oxc-parser";
import { TypeRegistry } from "./type-registry.ts";
import { FunctionRegistry, type FunctionEntry, type ParamInfo } from "./function-registry.ts";
import { hashFunctionBody } from "../utils/hash.ts";
import { prop, child, children } from "../utils/narrow.ts";

export interface ProjectIndex {
  types: TypeRegistry;
  functions: FunctionRegistry;
  callSites: CallSite[];
  files: Map<string, { source: string; program: Node; comments: Comment[] }>;
}

export interface CallSite {
  calleeName: string;
  file: string;
  line: number;
  argCount: number;
  node: Node;
}

export function collectProject(files: string[]): ProjectIndex {
  const types = new TypeRegistry();
  const functions = new FunctionRegistry();
  const callSites: CallSite[] = [];
  const fileMap = new Map<string, { source: string; program: Node; comments: Comment[] }>();

  for (const file of files) {
    const source = readFileSync(file, "utf8");
    const result = parseSync(file, source);
    fileMap.set(file, { source, program: result.program, comments: result.comments });

    walk(result.program, {
      enter(node: Node, parent: Node | null) {
        collectTypes(node, parent, file, source, types);
        collectFunctions(node, parent, file, source, functions);
        collectCallSites(node, file, source, callSites);
      },
    });
  }

  return { types, functions, callSites, files: fileMap };
}

function lineAt(source: string, offset: number): number {
  let line = 1;
  for (let i = 0; i < offset; i++) {
    if (source[i] === "\n") line++;
  }
  return line;
}

function collectTypes(node: Node, parent: Node | null, file: string, source: string, registry: TypeRegistry): void {
  if (node.type === "TSTypeAliasDeclaration") {
    const id = child(node, "id");
    const typeAnno = child(node, "typeAnnotation");
    if (id && typeAnno) {
      registry.add(prop<string>(id, "name"), file, lineAt(source, node.start), typeAnno, source, isExported(parent));
    }
  }
  if (node.type === "TSInterfaceDeclaration") {
    const id = child(node, "id");
    const body = child(node, "body");
    if (id && body) {
      registry.add(prop<string>(id, "name"), file, lineAt(source, node.start), body, source, isExported(parent));
    }
  }
}

function isExported(parent: Node | null): boolean {
  if (parent === null) return false;
  return parent.type === "ExportNamedDeclaration" || parent.type === "ExportDefaultDeclaration";
}

function collectFunctions(node: Node, parent: Node | null, file: string, source: string, registry: FunctionRegistry): void {
  if (node.type === "FunctionDeclaration" || node.type === "FunctionExpression") {
    const id = child(node, "id");
    const body = child(node, "body");
    if (!id || !body) return;
    const name = prop<string>(id, "name");
    const params = extractParams(children(node, "params"), source);
    const hash = hashFunctionBody(body, source);
    const exported = isExported(parent);
    registry.add({ name, file, line: lineAt(source, node.start), hash, params, node, exported });
  }
  // Arrow functions assigned to const
  if (node.type === "VariableDeclarator") {
    const init = child(node, "init");
    const id = child(node, "id");
    if (init !== null && init.type === "ArrowFunctionExpression" && id !== null && id.type === "Identifier") {
      const body = child(init, "body");
      if (!body) return;
      const name = prop<string>(id, "name");
      const params = extractParams(children(init, "params"), source);
      const hash = hashFunctionBody(body, source);
      // Parent is VariableDeclaration; check if "export" precedes the declaration on the same line
      const lineStart = source.lastIndexOf("\n", node.start) + 1;
      const linePrefix = source.slice(lineStart, node.start);
      const exported = linePrefix.includes("export");
      registry.add({ name, file, line: lineAt(source, node.start), hash, params, node, exported });
    }
  }
}

function paramName(node: Node, source: string): string {
  const name = prop<string>(node, "name");
  if (name !== undefined) return name;
  return source.slice(node.start, node.end);
}

function typeText(node: Node | null, source: string): string | null {
  if (node === null) return null;
  return source.slice(node.start, node.end);
}

function extractParams(params: Node[], source: string): ParamInfo[] {
  return params.map((p) => {
    if (p.type === "AssignmentPattern") {
      const left = child(p, "left");
      if (left === null) {
        return { name: "?", optional: false, hasDefault: true, typeText: null };
      }
      return {
        name: paramName(left, source),
        optional: prop<boolean>(left, "optional") === true,
        hasDefault: true,
        typeText: typeText(child(left, "typeAnnotation"), source),
      };
    }
    const typeAnno = child(p, "typeAnnotation");
    return {
      name: paramName(p, source),
      optional: prop<boolean>(p, "optional") === true,
      hasDefault: false,
      typeText: typeText(typeAnno, source),
    };
  });
}

function collectCallSites(node: Node, file: string, source: string, sites: CallSite[]): void {
  if (node.type !== "CallExpression") return;
  const callee = child(node, "callee");
  let calleeName: string | null = null;
  if (callee !== null && callee.type === "Identifier") {
    calleeName = prop<string>(callee, "name");
  } else if (callee !== null && callee.type === "MemberExpression" && prop<boolean>(callee, "computed") !== true) {
    const property = child(callee, "property");
    if (property) calleeName = prop<string>(property, "name");
  }
  if (calleeName) {
    sites.push({
      calleeName,
      file,
      line: lineAt(source, node.start),
      argCount: children(node, "arguments").length,
      node,
    });
  }
}
