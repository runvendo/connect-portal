import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // jsdom over happy-dom: happy-dom + vi.useFakeTimers() + React 19 deadlocks
    // on Linux CI (afterEach hooks hang). jsdom doesn't have the same issue.
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    globals: true,
  },
});
