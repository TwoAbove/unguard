export interface Source {
  readonly name: string;
  resolve(id: string): Promise<Outcome>;
}

export interface Handle {
  readonly name: string;
  readonly attempts: number;
  readonly label?: string;
}

export type Outcome =
  | { kind: "found"; content: string }
  | { kind: "missing" }
  | { kind: "transient"; reason: string };
