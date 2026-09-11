import defaultThing, { namedThing as localThing } from "./imported";
import * as importedNamespace from "./imported";

export { namedThing as forwardedThing } from "./imported";
export * from "./imported";

export const importedValues = [defaultThing(), localThing(), importedNamespace.namedThing()];
