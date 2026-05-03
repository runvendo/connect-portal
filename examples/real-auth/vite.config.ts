import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const pkgRoot = resolve(here, "../..");

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, here, "");
  // Browser→vendo.run is blocked by CORS in dev. Proxy /api/* through Vite so
  // requests go server-to-server. The playground sets baseUrl to its own
  // origin, so SDK paths like /api/integrations land here and get forwarded.
  const target = env.VITE_VENDO_BASE_URL || "https://vendo.run";

  return {
    root: here,
    plugins: [react()],
    resolve: {
      alias: {
        "@vendodev/connect-portal/styles.css": resolve(
          pkgRoot,
          "src/components/styles.css",
        ),
        "@vendodev/connect-portal": resolve(pkgRoot, "src/index.ts"),
      },
    },
    server: {
      port: 5174,
      proxy: {
        "/api": { target, changeOrigin: true, secure: true, ws: true },
        "/connect": { target, changeOrigin: true, secure: true },
      },
    },
  };
});
