import * as ts from "typescript";

/** Extract static property names from an object literal. Returns null if any property is dynamic (spread, computed). */
export function extractPropertyNames(node: ts.ObjectLiteralExpression): string[] | null {
  const names: string[] = [];
  for (const prop of node.properties) {
    if (ts.isSpreadAssignment(prop)) return null;
    if (ts.isPropertyAssignment(prop)) {
      if (ts.isIdentifier(prop.name)) names.push(prop.name.text);
      else if (ts.isStringLiteral(prop.name)) names.push(prop.name.text);
      else return null;
    } else if (ts.isShorthandPropertyAssignment(prop)) {
      names.push(prop.name.text);
    } else if (ts.isMethodDeclaration(prop)) {
      if (ts.isIdentifier(prop.name)) names.push(prop.name.text);
      else return null;
    } else if (ts.isGetAccessorDeclaration(prop) || ts.isSetAccessorDeclaration(prop)) {
      if (ts.isIdentifier(prop.name)) names.push(prop.name.text);
      else return null;
    }
  }
  return names;
}

/** Sort property names, compute a canonical key, and get-or-create the group list in the map. */
export function getShapeGroup<T>(map: Map<string, T[]>, props: string[]): { sorted: string[]; list: T[] } {
  const sorted = [...props].sort();
  const key = sorted.join("\0");
  let list = map.get(key);
  if (!list) {
    list = [];
    map.set(key, list);
  }
  return { sorted, list };
}
