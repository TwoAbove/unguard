declare const obj: { prop: string; method(): void; items: string[] };
declare const user: { name: string };

// Basic: obj && obj.prop
if (obj && obj.prop) {} // @expect no-redundant-existence-guard
if (user && user.name) {} // @expect no-redundant-existence-guard

// Method call: obj && obj.method()
if (obj && obj.method()) {} // @expect no-redundant-existence-guard

// Element access: obj && obj.items[0]
if (obj && obj.items[0]) {} // @expect no-redundant-existence-guard

// Explicit null check: obj != null && obj.prop
if (obj != null && obj.prop) {} // @expect no-redundant-existence-guard
if (obj !== null && obj.prop) {} // @expect no-redundant-existence-guard
if (obj !== undefined && obj.prop) {} // @expect no-redundant-existence-guard

// Non-if context: const val = obj && obj.prop
const val = obj && obj.prop; // @expect no-redundant-existence-guard
