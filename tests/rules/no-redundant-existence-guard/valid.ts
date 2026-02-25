// Different identifiers - not a redundant guard
declare const isReady: boolean;
declare const obj: { prop: string };
if (isReady && obj.prop) {}

// Nullable type - guard is legitimate
declare const maybe: { name: string } | null;
if (maybe && maybe.name) {}

declare const optUser: { name: string } | undefined;
if (optUser && optUser.name) {}

// Nullable with method call — guard is legitimate
declare const maybeService: { start(): void } | null;
if (maybeService && maybeService.start()) {}

// Nullable with null check
declare const maybeObj: { val: number } | null;
if (maybeObj != null && maybeObj.val) {}

// Non-if with nullable — legitimate
declare const optConfig: { debug: boolean } | undefined;
const flag = optConfig && optConfig.debug;
