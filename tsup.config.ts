import { defineConfig } from "tsup";
import { cpSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Copy src/components/styles.css → dist/components/styles.css so the
// exports map "./styles.css": "./dist/components/styles.css" resolves.
// tsup's loader:copy only handles files imported from entry points;
// styles.css is a standalone consumer-imported stylesheet, so we copy it manually.
function copyStyles() {
  const src = join(__dirname, "src/components/styles.css");
  const dest = join(__dirname, "dist/components/styles.css");
  mkdirSync(dirname(dest), { recursive: true });
  cpSync(src, dest);
}

export default defineConfig([
  // Main entry: ESM + CJS + d.ts
  {
    entry: { index: "src/index.ts" },
    format: ["esm", "cjs"],
    dts: true,
    clean: true,
    sourcemap: true,
    external: ["react", "react-dom", "@vendodev/sdk"],
    async onSuccess() {
      copyStyles();
    },
  },
  // Testing sub-entry: separate output so consumers can tree-shake test helpers
  {
    entry: { "testing/index": "src/testing/index.ts" },
    format: ["esm", "cjs"],
    dts: true,
    clean: false,
    sourcemap: true,
    external: ["react", "react-dom", "@vendodev/sdk"],
  },
]);
