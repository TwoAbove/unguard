import type * as ts from "typescript";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
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
  const byNameAndPackage = new Map<string, T[]>();
  for (const entry of entries) {
    if (!entry.exported) continue;
    const pkg = findPackageRoot(entry.file);
    const key = `${pkg}\0${entry.name}`;
    let list = byNameAndPackage.get(key);
    if (list === undefined) {
      list = [];
      byNameAndPackage.set(key, list);
    }
    list.push(entry);
  }
  return [...byNameAndPackage.values()].filter((group) => {
    if (group.length < 2) return false;
    const files = new Set(group.map((e) => e.file));
    return files.size > 1;
  });
}

const packageRootCache = new Map<string, string>();

function findPackageRoot(filePath: string): string {
  let dir = dirname(filePath);
  const cached = packageRootCache.get(dir);
  if (cached !== undefined) return cached;

  const startDir = dir;
  const visited: string[] = [dir];
  while (dir !== dirname(dir)) {
    if (existsSync(join(dir, "package.json"))) {
      for (const d of visited) packageRootCache.set(d, dir);
      return dir;
    }
    dir = dirname(dir);
    visited.push(dir);
  }
  for (const d of visited) packageRootCache.set(d, dir);
  return dir;
}
