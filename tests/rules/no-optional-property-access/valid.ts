// Direct property access - not flagged
declare const obj: { prop: string; nested: { deep: string } };
const x = obj.prop;
const y = obj.nested.deep;

// Nullable type - ?. is legitimate
declare const maybe: { prop: string } | null;
const z = maybe?.prop;

declare const optObj: { nested: { deep: string } } | undefined;
const w = optObj?.nested?.deep;
