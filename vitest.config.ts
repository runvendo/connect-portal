import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "happy-dom",
    setupFiles: ["./tests/setup.ts"],
    globals: true,
    // Fake-timer + React-scheduler interaction is slower under Linux/Node 18 CI;
    // the popup tests exceed default 5s/10s budgets there. Local macOS runs in <1s.
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
