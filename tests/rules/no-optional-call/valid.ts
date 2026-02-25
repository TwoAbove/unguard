// Direct call - not flagged
declare const fn: () => void;
declare const obj: { method: () => void };
fn();
obj.method();

// Nullable function - ?. is legitimate
declare const maybeFn: (() => void) | null;
maybeFn?.();

declare const maybeObj: { method: () => void } | undefined;
maybeObj?.method();
