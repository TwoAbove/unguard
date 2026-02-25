import type * as ts from "typescript";

export interface ParamInfo {
  name: string;
  optional: boolean;
  hasDefault: boolean;
  typeText: string | null;
}

export interface FunctionEntry {
  name: string;
  file: string;
  line: number;
  hash: string;
  params: ParamInfo[];
  node: ts.Node;
  exported: boolean;
  symbol?: ts.Symbol;
}

export class FunctionRegistry {
  private entries: FunctionEntry[] = [];
  private byHash = new Map<string, FunctionEntry[]>();

  add(entry: FunctionEntry): void {
    this.entries.push(entry);
    let list = this.byHash.get(entry.hash);
    if (list === undefined) {
      list = [];
      this.byHash.set(entry.hash, list);
    }
    list.push(entry);
  }

  getDuplicateGroups(): FunctionEntry[][] {
    return [...this.byHash.values()].filter((group) => group.length > 1);
  }

  getAll(): FunctionEntry[] {
    return this.entries;
  }

  getByName(name: string): FunctionEntry[] {
    return this.entries.filter((e) => e.name === name);
  }

  getNameCollisionGroups(): FunctionEntry[][] {
    const byName = new Map<string, FunctionEntry[]>();
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
