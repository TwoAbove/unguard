import type * as ts from "typescript";
import { hashTypeShape } from "../utils/hash.ts";
import { BaseRegistry } from "./base-registry.ts";

export interface InlineParamTypeEntry {
  file: string;
  line: number;
  hash: string;
  typeText: string;
  node: ts.Node;
}

export class InlineParamTypeRegistry extends BaseRegistry<InlineParamTypeEntry> {
  add(file: string, line: number, typeNode: ts.TypeLiteralNode, sourceFile: ts.SourceFile): void {
    const hash = hashTypeShape(typeNode, sourceFile);
    const typeText = typeNode.getText(sourceFile).replace(/\s+/g, " ").trim();
    this.addEntry({ file, line, hash, typeText, node: typeNode }, hash);
  }
}
