import { createRule } from "./factory.ts";

export const alpha = createRule({
  id: "alpha",
  severity: "warning",
  message: "alpha diagnostic",
});
