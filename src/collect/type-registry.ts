import type { Node } from "oxc-parser";
import { hashTypeShape } from "../utils/hash.ts";

export interface TypeEntry {
  name: string;
  file: string;
  line: number;
  hash: string;
  node: Node;
  exported: boolean;
}

export class TypeRegistry {
  private entries: TypeEntry[] = [];
  private byHash = new Map<string, TypeEntry[]>();

  add(name: string, file: string, line: number, typeNode: Node, source: string, exported: boolean): void {
    const hash = hashTypeShape(typeNode, source);
    const entry: TypeEntry = { name, file, line, hash, node: typeNode, exported };
    this.entries.push(entry);
    let list = this.byHash.get(hash);
    if (list === undefined) {
      list = [];
      this.byHash.set(hash, list);
    }
    list.push(entry);
  }

  getDuplicateGroups(): TypeEntry[][] {
    return [...this.byHash.values()].filter((group) => group.length > 1);
  }

  getAll(): TypeEntry[] {
    return this.entries;
  }

  getNameCollisionGroups(): TypeEntry[][] {
    const byName = new Map<string, TypeEntry[]>();
    for (const entry of this.entries) {
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
}
