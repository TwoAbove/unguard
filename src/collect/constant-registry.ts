import { BaseRegistry } from "./base-registry.ts";

export interface ConstantEntry {
  name: string;
  file: string;
  line: number;
  valueHash: string;
  valueText: string;
  exported: boolean;
}

export class ConstantRegistry extends BaseRegistry<ConstantEntry> {
  add(entry: ConstantEntry): void {
    this.addEntry(entry, entry.valueHash);
  }
}
