import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    cli: "src/cli.ts",
    worker: "src/scan/worker.ts",
  },
  format: ["esm"],
  dts: { entry: { index: "src/index.ts", cli: "src/cli.ts" } },
  clean: true,
  sourcemap: true,
});
