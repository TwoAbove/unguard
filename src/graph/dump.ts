import type {
  ArgShape,
  CallFact,
  ConstantFact,
  FunctionFact,
  Graph,
  SignatureFact,
  TypeFact,
} from "./types.ts";

type Declaration = FunctionFact | TypeFact | ConstantFact;

export function dumpDeclaration(graph: Graph, file: string, line: number): string {
  const declaration = findDeclaration(graph, file, line);
  if (declaration === undefined) return `no declaration at ${file}:${line}`;

  const sections = [
    section("declaration", [formatDeclaration(declaration)]),
    section("readers", typeInfoRows(graph, () => graph.readers(declaration.id).map((reader) =>
      `${reader.kind} ${formatSite(reader.site)}`
    ))),
    section("callers", typeInfoRows(graph, () => graph.callers(declaration.id).map(formatCall))),
    section("overloads", typeInfoRows(graph, () => graph.overloads(declaration.id).map(formatSignature))),
    section("signature constraints", typeInfoRows(graph, () =>
      graph.signatureConstraints().has(declaration.id) ? ["inherited member contract"] : []
    )),
    section("importers", graph.importers(declaration.site.file).map((entry) =>
      `${entry.kind} ${entry.file}:${entry.site.line} ${entry.importedName}→${entry.localName}`
    )),
    section("exports", graph.exports().filter((entry) => entry.decl === declaration.id).map((entry) =>
      `${entry.kind} ${entry.file} ${entry.name}`
    )),
    section("duplicates", duplicateRows(graph, declaration)),
    section("presence", presenceRows(graph, declaration)),
  ];
  return sections.join("\n\n");
}

function findDeclaration(graph: Graph, file: string, line: number): Declaration | undefined {
  return graph.functions().find((fact) => fact.site.file === file && fact.site.line === line)
    ?? graph.types().find((fact) => fact.site.file === file && fact.site.line === line)
    ?? graph.constants().find((fact) => fact.site.file === file && fact.site.line === line);
}

function section(name: string, rows: readonly string[]): string {
  return `${name}\n${rows.length === 0 ? "(none)" : rows.join("\n")}`;
}

function formatDeclaration(declaration: Declaration): string {
  const leading = ["kind", "id", "name", "exported"] as const;
  const fields = leading.map((key) => `${key}=${String(declaration[key])}`);
  for (const [key, value] of Object.entries(declaration)) {
    if (leading.includes(key as typeof leading[number]) || (typeof value === "object" && value !== null)) continue;
    fields.push(`${key}=${String(value)}`);
  }
  return fields.join(" ");
}

function typeInfoRows(graph: Graph, query: () => string[]): string[] {
  try {
    return query();
  } catch (error) {
    if (!graph.hasTypeInfo) return ["<needs type info>"];
    throw error;
  }
}



function formatCall(call: CallFact): string {
  const fields = [
    formatSite(call.site),
    `argCount=${call.args.length}`,
    `args=[${call.args.map(formatArg).join(", ")}]`,
  ];
  if (call.isNew) fields.push("new");
  if (call.resolvedSignature !== null) fields.push(`sig=${call.resolvedSignature}`);
  return fields.join(" ");
}

function formatArg(arg: ArgShape): string {
  switch (arg.kind) {
    case "literal":
      return `literal(${arg.text})`;
    case "spread":
      return "spread";
    case "identifier":
      return `identifier(${arg.decl ?? "null"})`;
    case "other":
      return "other";
  }
}

function formatSignature(signature: SignatureFact): string {
  const typeParams = signature.typeParams.map(({ name, constraintText }) =>
    constraintText === null ? name : `${name} extends ${constraintText}`
  );
  const fields = [
    `${signature.site.file}:${signature.site.line}`,
    `typeParams=[${typeParams.join(", ")}]`,
  ];
  if (signature.hasBody) fields.splice(1, 0, "impl");
  return fields.join(" ");
}


function duplicateRows(graph: Graph, declaration: Declaration): string[] {
  const groups: readonly [string, readonly (readonly { id: string }[])[]][] = declaration.kind === "function"
    ? [["function", graph.duplicateGroups("function")], ["function-normalized", graph.duplicateGroups("function-normalized")]]
    : declaration.kind === "type"
    ? [["type", graph.duplicateGroups("type")]]
    : [["constant", graph.duplicateGroups("constant")]];
  const rows: string[] = [];
  for (const [kind, duplicateGroups] of groups) {
    for (const group of duplicateGroups) {
      if (!group.some((member) => member.id === declaration.id)) continue;
      for (const member of group) {
        if (member.id !== declaration.id) rows.push(`${kind} ${member.id}`);
      }
    }
  }
  return rows;
}

function presenceRows(graph: Graph, declaration: Declaration): string[] {
  if (declaration.kind !== "type") return ["n/a"];
  return typeInfoRows(graph, () => {
    const presence = graph.presence();
    return [
      ...[...(presence.observed.get(declaration.id) ?? [])].map((key) => `observed ${key}`),
      ...[...(presence.edges.get(declaration.id) ?? [])].map((id) => `edge ${id}`),
    ];
  });
}

function formatSite(site: { file: string; line: number; column: number }): string {
  return `${site.file}:${site.line}:${site.column}`;
}
