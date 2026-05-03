#!/usr/bin/env node
// Hard cap: 30KB gzipped for dist/index.js.
// Exits non-zero if the cap is exceeded so CI / prepublishOnly fails loudly.
import { readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BUNDLE_PATH = join(__dirname, "../dist/index.js");
const CAP_BYTES = 30 * 1024; // 30 KB

let source;
try {
  source = readFileSync(BUNDLE_PATH);
} catch {
  console.error(`[size:check] Could not read ${BUNDLE_PATH}. Run "npm run build" first.`);
  process.exit(1);
}

const gzipped = gzipSync(source);
const kb = (gzipped.length / 1024).toFixed(2);
const capKb = (CAP_BYTES / 1024).toFixed(0);

if (gzipped.length > CAP_BYTES) {
  console.error(
    `[size:check] FAIL: dist/index.js is ${kb} KB gzipped — exceeds the ${capKb} KB cap.`
  );
  process.exit(1);
}

console.log(`[size:check] OK: dist/index.js is ${kb} KB gzipped (cap: ${capKb} KB).`);
