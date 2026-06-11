import { takesLocal, USED_LIMIT, type UsedAlias, type UsedShape } from "./lib";

function main(shape: UsedShape, alias: UsedAlias): number {
  return takesLocal({ flag: alias.name.length > USED_LIMIT }) + shape.id.length;
}
