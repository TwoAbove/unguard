import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { defineConfig } from "tsdown";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    cli: "src/cli.ts",
    worker: "src/scan/worker.ts",
  },
  format: ["esm"],
  // Keep `.js` output: bin/unguard.mjs imports ../dist/cli.js and the worker
  // pool resolves ./worker.js relative to dist output.
  fixedExtension: false,
  dts: { entry: ["src/index.ts", "src/cli.ts"], sourcemap: false },
  sourcemap: true,
  exports: false,
  hooks: {
    // The JS-level `sourcemap: true` makes rolldown append sourceMappingURL
    // comments to .d.ts chunks even though dts maps are disabled, leaving
    // dangling references in published files. Strip them. Remove once tsdown
    // scopes the sourcemap option away from declaration output.
    "build:done": async (ctx) => {
      for (const file of await readdir(ctx.options.outDir)) {
        if (!file.endsWith(".d.ts")) continue;
        const path = join(ctx.options.outDir, file);
        const text = await readFile(path, "utf8");
        const stripped = text.replace(/\n?\/\/# sourceMappingURL=\S+\s*$/, "\n");
        if (stripped !== text) await writeFile(path, stripped);
      }
    },
  },
});
