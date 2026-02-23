import type { Node } from "oxc-parser";
import { prop } from "./narrow.ts";

/** Check if a node is null or undefined literal. */
export function isNullish(node: Node): boolean {
  if (node.type === "Literal" && prop(node, "value") === null) return true;
  if (node.type === "Identifier" && prop<string>(node, "name") === "undefined") return true;
  return false;
}

/** Check if a node is a literal value. */
export function isLiteral(node: Node): boolean {
  switch (node.type) {
    case "Literal":
    case "TemplateLiteral":
    case "ArrayExpression":
    case "ObjectExpression":
      return true;
    case "Identifier":
      return prop<string>(node, "name") === "undefined";
    default:
      return false;
  }
}

/** Get source text for a node using its span. */
export function getNodeText(source: string, node: Node): string {
  return source.slice(node.start, node.end);
}
