import { createRule } from "./factory.ts";

export const beta = createRule({
  id: "beta",
  severity: "warning",
  message: "beta diagnostic",
});
