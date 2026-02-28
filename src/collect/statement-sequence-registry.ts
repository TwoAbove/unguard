import { DualHashRegistry } from "./base-registry.ts";

export interface StatementSequenceEntry {
  file: string;
  line: number;
  endLine: number;
  hash: string;
  normalizedHash: string;
  statementCount: number;
  normalizedBodyLength: number;
}

export class StatementSequenceRegistry extends DualHashRegistry<StatementSequenceEntry> {
  add(entry: StatementSequenceEntry): void {
    this.addWithSecondary(entry, entry.hash, entry.normalizedHash);
  }

  getNormalizedDuplicateGroups(): StatementSequenceEntry[][] {
    return this.getSecondaryDuplicateGroups();
  }
}
