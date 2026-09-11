import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { dumpDeclaration } from "../../src/graph/dump.ts";
import { buildGraph } from "../../src/graph/graph.ts";
import { createProgramForGroup, groupFilesByTsconfig } from "../../src/typecheck/program.ts";

const fixtureNames = [
  "callers.ts",
  "duplicates.ts",
  "duplicates2.ts",
  "imported.ts",
  "imports.ts",
  "overloads.ts",
  "presence.ts",
  "readers.ts",
];
const fixtureFiles = fixtureNames.map((name) => fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url)));
const [group] = groupFilesByTsconfig(fixtureFiles);
if (group === undefined) throw new Error("graph fixtures did not form a program group");
const program = createProgramForGroup(group, {});
const graph = buildGraph(program, { files: new Set(fixtureFiles) });

function functionNamed(name: string) {
  const fact = graph.functions().find((entry) => entry.name === name);
  if (fact === undefined) throw new Error(`missing function fact ${name}`);
  return fact;
}

function typeNamed(name: string) {
  const fact = graph.types().find((entry) => entry.name === name);
  if (fact === undefined) throw new Error(`missing type fact ${name}`);
  return fact;
}

describe("project graph queries", () => {
  it("records callers and argument shapes", () => {
    const calls = graph.callers(functionNamed("target").id);
    const [countParameter] = functionNamed("callTarget").params;
    if (countParameter === undefined) throw new Error("missing callTarget parameter fact");

    expect(calls).toHaveLength(2);
    expect(calls.map((call) => call.args.length)).toEqual([2, 1]);
    expect(calls[0]?.args).toEqual([
      { kind: "literal", text: '"literal"' },
      { kind: "identifier", decl: countParameter.id },
    ]);
    expect(calls[1]?.args).toEqual([{ kind: "spread" }]);
    expect(graph.calls().some((call) => call.isNew)).toBe(true);
  });

  it("maps an overload call to its first signature", () => {
    const choose = functionNamed("choose");
    const signatures = graph.overloads(choose.id);
    const [call] = graph.callers(choose.id);

    expect(signatures).toHaveLength(3);
    expect(signatures.map((signature) => signature.hasBody)).toEqual([false, false, true]);
    expect(call?.resolvedSignature).toBe(0);
  });

  it("records every import form and resolves the imported file", () => {
    const importedFile = fixtureFiles[3];
    if (importedFile === undefined) throw new Error("missing imported fixture path");
    const imports = graph.imports().filter((entry) => entry.file.endsWith("/imports.ts"));

    expect(imports.map((entry) => entry.kind).sort()).toEqual([
      "default",
      "named",
      "namespace",
      "reexport-named",
      "reexport-star",
    ]);
    expect(imports.every((entry) => entry.resolvedFile === importedFile)).toBe(true);
  });

  it("classifies declaration readers", () => {
    const token = graph.constants().find((entry) => entry.name === "token");
    if (token === undefined) throw new Error("missing constant fact token");
    const kinds = new Set(graph.readers(token.id).map((reader) => reader.kind));

    expect([...kinds]).toEqual(expect.arrayContaining([
      "call",
      "argument",
      "spread",
      "keyed",
      "narrow",
      "type-reference",
    ]));
  });

  it("counts a shorthand property as a read of its value", () => {
    const token = graph.constants().find((entry) => entry.name === "token");
    if (token === undefined) throw new Error("missing constant fact token");
    const shorthandReads = graph.readers(token.id).filter((reader) => reader.kind === "read");
    expect(shorthandReads.length).toBeGreaterThanOrEqual(1);
  });

  it("groups duplicate functions and type literals", () => {
    const duplicateFunction = functionNamed("duplicateOne");
    const duplicateType = typeNamed("ShapeOne");
    const functionGroup = graph.duplicateGroups("function").find((entries) =>
      entries.some((entry) => entry.id === duplicateFunction.id)
    );
    const typeGroup = graph.duplicateGroups("type").find((entries) =>
      entries.some((entry) => entry.id === duplicateType.id)
    );

    expect(functionGroup).toHaveLength(2);
    expect(typeGroup).toHaveLength(2);
  });

  it("records observed presence keys", () => {
    const type = typeNamed("PresenceOptions");

    expect(graph.presence().observed.get(type.id)).toContain("retry");
  });

  it("prints every declaration query section", () => {
    const target = functionNamed("target");
    const output = dumpDeclaration(graph, target.site.file, target.site.line);

    for (const header of [
      "declaration",
      "readers",
      "callers",
      "overloads",
      "importers",
      "exports",
      "duplicates",
      "presence",
    ]) {
      expect(output).toMatch(new RegExp(`^${header}$`, "m"));
    }
  });
});
