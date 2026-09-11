import type * as ts from "typescript";
import type { SemanticServices } from "../rules/types.ts";
import { SemanticCache } from "../typecheck/semantic-cache.ts";
import { buildDeclarations, type DeclarationFacts } from "./families/declarations.ts";
import { buildReferences, type ReferenceFacts } from "./families/references.ts";
import { buildPresence } from "./presence.ts";
import { findMaximalMatches } from "./statement-sequences.ts";
import type {
  CallFact,
  ConstantFact,
  DuplicateFactOf,
  DuplicateKind,
  ExportFact,
  FileFact,
  FunctionFact,
  Graph,
  ImportFact,
  InlineParamTypeFact,
  MaximalMatch,
  NodeId,
  ObjectLiteralFact,
  OverloadFamilyFact,
  PresenceFacts,
  ReaderFact,
  SignatureFact,
  TypeFact,
} from "./types.ts";

export type { Graph } from "./types.ts";

/**
 * What a family builder receives. `sourceFiles` are the project files the
 * graph covers (never declaration files, never node_modules). The checker and
 * friends are absent in source-only mode; builders that need them are never
 * invoked without them because the querying rule declares `requiresTypeInfo`.
 */
export interface GraphInput {
  sourceFiles: readonly ts.SourceFile[];
  checker?: ts.TypeChecker;
  semantics?: SemanticServices;
  compilerOptions?: ts.CompilerOptions;
}

export interface BuildGraphOptions {
  /** Restrict the graph to these files; defaults to every non-declaration, non-node_modules file of the program. */
  files?: ReadonlySet<string>;
}

/** Build a graph over a type-checked program. */
export function buildGraph(program: ts.Program, options: BuildGraphOptions = {}): Graph {
  const sourceFiles = program.getSourceFiles().filter((sf) => {
    if (sf.isDeclarationFile) return false;
    if (sf.fileName.includes("node_modules")) return false;
    return options.files === undefined || options.files.has(sf.fileName);
  });
  const checker = program.getTypeChecker();
  return new ProjectGraph({
    sourceFiles,
    checker,
    semantics: new SemanticCache(checker),
    compilerOptions: program.getCompilerOptions(),
  });
}

/** Build a graph from parsed sources alone; checker-backed queries throw. */
export function buildSourceOnlyGraph(sourceFiles: readonly ts.SourceFile[]): Graph {
  return new ProjectGraph({ sourceFiles });
}

export function nodeId(node: ts.Node, sourceFile: ts.SourceFile): NodeId {
  return `${sourceFile.fileName}:${node.getStart(sourceFile)}-${node.getEnd()}`;
}

class ProjectGraph implements Graph {
  readonly fileNames: readonly string[];
  readonly hasTypeInfo: boolean;

  private declarationFacts: DeclarationFacts | undefined;
  private referenceFacts: ReferenceFacts | undefined;
  private presenceFacts: PresenceFacts | undefined;
  private duplicateCache = new Map<DuplicateKind, unknown[][]>();
  private callersIndex: Map<NodeId, CallFact[]> | undefined;
  private importersIndex: Map<string, ImportFact[]> | undefined;

  constructor(private readonly input: GraphInput) {
    this.fileNames = input.sourceFiles.map((sf) => sf.fileName);
    this.hasTypeInfo = input.checker !== undefined;
  }

  // -- Declarations ---------------------------------------------------------

  private decls(): DeclarationFacts {
    if (this.declarationFacts === undefined) this.declarationFacts = buildDeclarations(this.input);
    return this.declarationFacts;
  }

  functions(): readonly FunctionFact[] {
    return this.decls().functions;
  }

  types(): readonly TypeFact[] {
    return this.decls().types;
  }

  constants(): readonly ConstantFact[] {
    return this.decls().constants;
  }

  inlineParamTypes(): readonly InlineParamTypeFact[] {
    return this.decls().inlineParamTypes;
  }

  files(): readonly FileFact[] {
    return this.decls().files;
  }

  objectLiterals(): readonly ObjectLiteralFact[] {
    return this.decls().objectLiterals;
  }

  duplicateGroups<K extends DuplicateKind>(kind: K): DuplicateFactOf[K][][] {
    const cached = this.duplicateCache.get(kind);
    if (cached !== undefined) return cached as DuplicateFactOf[K][][];
    const groups = kind === "function-normalized"
      ? groupByHash(this.functions(), (f) => f.normalizedHash)
      : groupByHash(this.factsFor(kind), (f) => f.hash);
    this.duplicateCache.set(kind, groups);
    return groups as DuplicateFactOf[K][][];
  }

  private factsFor(kind: DuplicateKind): readonly DuplicateFactOf[DuplicateKind][] {
    switch (kind) {
      case "type":
        return this.types();
      case "function":
      case "function-normalized":
        return this.functions();
      case "constant":
        return this.constants();
      case "inline-param-type":
        return this.inlineParamTypes();
      case "file":
        return this.files();
    }
  }

  nameCollisions(kind: "function"): FunctionFact[][];
  nameCollisions(kind: "type"): TypeFact[][];
  nameCollisions(kind: "function" | "type"): FunctionFact[][] | TypeFact[][] {
    const packageOf = new Map(this.files().map((f) => [f.file, f.packageRoot]));
    const entries: readonly (FunctionFact | TypeFact)[] = kind === "function" ? this.functions() : this.types();
    const byKey = new Map<string, (FunctionFact | TypeFact)[]>();
    for (const entry of entries) {
      if (!entry.exported) continue;
      const key = `${packageOf.get(entry.site.file) ?? ""}\0${entry.name}`;
      let list = byKey.get(key);
      if (list === undefined) {
        list = [];
        byKey.set(key, list);
      }
      list.push(entry);
    }
    return [...byKey.values()].filter((group) => {
      if (group.length < 2) return false;
      return new Set(group.map((e) => e.site.file)).size > 1;
    }) as FunctionFact[][] | TypeFact[][];
  }

  duplicateStatementSequences(minStatements: number, minNormalizedBody: number): MaximalMatch[] {
    return findMaximalMatches(this.decls().blocks, minStatements, minNormalizedBody);
  }

  // -- Modules --------------------------------------------------------------

  private refs(): ReferenceFacts {
    if (this.referenceFacts === undefined) this.referenceFacts = buildReferences(this.input);
    return this.referenceFacts;
  }

  imports(): readonly ImportFact[] {
    return this.refs().imports;
  }

  importers(file: string): readonly ImportFact[] {
    if (this.importersIndex === undefined) {
      this.importersIndex = new Map();
      for (const imp of this.imports()) {
        if (imp.resolvedFile === null) continue;
        let list = this.importersIndex.get(imp.resolvedFile);
        if (list === undefined) {
          list = [];
          this.importersIndex.set(imp.resolvedFile, list);
        }
        list.push(imp);
      }
    }
    return this.importersIndex.get(file) ?? [];
  }

  exports(): readonly ExportFact[] {
    return this.refs().exports;
  }

  // -- References -----------------------------------------------------------

  private requireTypeInfo(query: string): void {
    if (!this.hasTypeInfo) {
      throw new Error(`Graph.${query} needs type information; the graph was built in source-only mode.`);
    }
  }

  calls(): readonly CallFact[] {
    this.requireTypeInfo("calls");
    return this.refs().calls;
  }

  callers(fn: NodeId): readonly CallFact[] {
    this.requireTypeInfo("callers");
    if (this.callersIndex === undefined) {
      this.callersIndex = new Map();
      for (const call of this.refs().calls) {
        if (call.callee === null) continue;
        let list = this.callersIndex.get(call.callee);
        if (list === undefined) {
          list = [];
          this.callersIndex.set(call.callee, list);
        }
        list.push(call);
      }
    }
    return this.callersIndex.get(fn) ?? [];
  }

  overloads(fn: NodeId): readonly SignatureFact[] {
    this.requireTypeInfo("overloads");
    return this.refs().overloads.get(fn)?.signatures ?? [];
  }

  overloadFamilies(): Iterable<OverloadFamilyFact> {
    this.requireTypeInfo("overloadFamilies");
    return this.refs().overloads.values();
  }

  signatureConstraints(): ReadonlySet<NodeId> {
    this.requireTypeInfo("signatureConstraints");
    return this.refs().signatureConstraints;
  }

  readers(decl: NodeId): readonly ReaderFact[] {
    this.requireTypeInfo("readers");
    return this.refs().readers.get(decl) ?? [];
  }

  // -- Presence -------------------------------------------------------------

  presence(): PresenceFacts {
    this.requireTypeInfo("presence");
    if (this.presenceFacts === undefined) this.presenceFacts = buildPresence(this.input);
    return this.presenceFacts;
  }
}

function groupByHash<T>(entries: readonly T[], hashOf: (entry: T) => string): T[][] {
  const byHash = new Map<string, T[]>();
  for (const entry of entries) {
    const hash = hashOf(entry);
    let list = byHash.get(hash);
    if (list === undefined) {
      list = [];
      byHash.set(hash, list);
    }
    list.push(entry);
  }
  return [...byHash.values()].filter((group) => group.length > 1);
}
