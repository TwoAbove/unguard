import { serialize, Sorter, type Serializable } from "./callee";

type JsonValue = Serializable & { id: string };

declare const value: JsonValue;
declare const values: JsonValue[];
declare const rawValue: { payload: string };
declare const rawValues: { key: string }[];

serialize(value);
serialize(rawValue, (item) => item.payload);

const sorter = new Sorter();
sorter.sort(values);
sorter.sort(rawValues, (item) => item.key);
