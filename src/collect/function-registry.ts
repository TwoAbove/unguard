import type * as ts from "typescript";
import { DualHashRegistry } from "./base-registry.ts";
import { getExportedNameCollisions } from "./type-registry.ts";

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
  normalizedHash: string;
  params: ParamInfo[];
  node: ts.Node;
  exported: boolean;
  symbol?: ts.Symbol;
  /** Whitespace-normalized body text length (for trivial-body filtering) */
  bodyLength: number;
  /** Fully-normalized body text length (strings/numbers/params replaced) */
  normalizedBodyLength: number;
  /** Class name for class methods (e.g. "Foo" for "Foo.bar"), undefined for standalone functions */
  className?: string;
  /** True if the declaring class has an `implements` clause */
  implementsInterface?: boolean;
}

export class FunctionRegistry extends DualHashRegistry<FunctionEntry> {
  add(entry: FunctionEntry): void {
    this.addWithSecondary(entry, entry.hash, entry.normalizedHash);
  }

  getNearDuplicateGroups(): FunctionEntry[][] {
    return this.getSecondaryDuplicateGroups().filter((group) => {
      // Exclude groups where all entries share the same exact hash
      // (those are already caught by duplicate-function-declaration)
      const hashes = new Set(group.map((e) => e.hash));
      return hashes.size > 1;
    });
  }

  getByName(name: string): FunctionEntry[] {
    return this.entries.filter((e) => e.name === name);
  }

  getNameCollisionGroups(): FunctionEntry[][] {
    return getExportedNameCollisions(this.entries);
  }
}
