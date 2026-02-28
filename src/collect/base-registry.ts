export class BaseRegistry<T> {
  protected entries: T[] = [];
  protected byHash = new Map<string, T[]>();

  protected addEntry(entry: T, hash: string): void {
    this.entries.push(entry);
    let list = this.byHash.get(hash);
    if (list === undefined) {
      list = [];
      this.byHash.set(hash, list);
    }
    list.push(entry);
  }

  getDuplicateGroups(): T[][] {
    return [...this.byHash.values()].filter((group) => group.length > 1);
  }

  getAll(): T[] {
    return this.entries;
  }
}

export class DualHashRegistry<T> extends BaseRegistry<T> {
  private bySecondaryHash = new Map<string, T[]>();

  protected addWithSecondary(entry: T, primaryHash: string, secondaryHash: string): void {
    this.addEntry(entry, primaryHash);
    let list = this.bySecondaryHash.get(secondaryHash);
    if (list === undefined) {
      list = [];
      this.bySecondaryHash.set(secondaryHash, list);
    }
    list.push(entry);
  }

  getSecondaryDuplicateGroups(): T[][] {
    return [...this.bySecondaryHash.values()].filter((group) => group.length > 1);
  }
}
