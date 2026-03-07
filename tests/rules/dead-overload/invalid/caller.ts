import { serialize, Sorter, type Serializable } from "./callee";

type JsonValue = Serializable & { id: string };

declare const value: JsonValue;
declare const values: JsonValue[];

serialize(value);
new Sorter().sort(values);
