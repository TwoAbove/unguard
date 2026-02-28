import type * as ts from "typescript";
import { hashTypeShape } from "../utils/hash.ts";
import { BaseRegistry } from "./base-registry.ts";

export interface TypeEntry {
  name: string;
  file: string;
  line: number;
  hash: string;
  node: ts.Node;
  exported: boolean;
}

export class TypeRegistry extends BaseRegistry<TypeEntry> {
  add(name: string, file: string, line: number, typeNode: ts.Node, sourceFile: ts.SourceFile, exported: boolean): void {
    const hash = hashTypeShape(typeNode, sourceFile);
    const entry: TypeEntry = { name, file, line, hash, node: typeNode, exported };
    this.addEntry(entry, hash);
  }

  getNameCollisionGroups(): TypeEntry[][] {
    return getExportedNameCollisions(this.entries);
  }
}

export function getExportedNameCollisions<T extends { name: string; file: string; exported: boolean }>(entries: T[]): T[][] {
  const byName = new Map<string, T[]>();
  for (const entry of entries) {
    if (!entry.exported) continue;
    let list = byName.get(entry.name);
    if (list === undefined) {
      list = [];
      byName.set(entry.name, list);
    }
    list.push(entry);
  }
  return [...byName.values()].filter((group) => {
    if (group.length < 2) return false;
    const files = new Set(group.map((e) => e.file));
    return files.size > 1;
  });
}
