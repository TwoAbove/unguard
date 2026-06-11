import { send } from "./impl.ts";

// Wrapper has fewer params than the call's positional args — partial application
// is real transformation.
export function sendToAlerts(payload: string): void {
  return send("alerts", payload);
}
