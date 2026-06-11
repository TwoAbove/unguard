// Structural similarity with varying literals — a lookup/dispatch table.
// This is intentional enumeration, NOT duplication. Must not fire.
export function mapStore(value: string): "apple" | "google" | null {
  const normalized = value.toLowerCase();
  if (normalized.includes("app_store")) return "apple";
  if (normalized.includes("app store")) return "apple";
  if (normalized.includes("mac_app_store")) return "apple";
  if (normalized.includes("mac app store")) return "apple";
  if (normalized.includes("play_store")) return "google";
  if (normalized.includes("play store")) return "google";
  return null;
}

// Enumerated parametric calls. Also lookup-table-ish; should not fire.
declare function set(key: string, value: number): void;
export function bootstrap(): void {
  set("alpha", 1);
  set("beta", 2);
  set("gamma", 3);
  set("delta", 4);
  set("epsilon", 5);
}

// URL/comment-looking literal contents are data, not comments.
declare function route(url: string, target: number): void;
export function registerRoutes(): void {
  route("http://alpha.example.com/path/*literal*/one", 1);
  route("http://beta.example.com/path/*literal*/two", 2);
  route("http://gamma.example.com/path/*literal*/three", 3);
  route("http://delta.example.com/path/*literal*/four", 4);
  route("http://epsilon.example.com/path/*literal*/five", 5);
}
