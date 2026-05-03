import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // jsdom over happy-dom: happy-dom + vi.useFakeTimers() + React 19 deadlocks
    // on Linux CI (afterEach hooks hang). jsdom doesn't have the same issue.
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    globals: true,
    // forks pool isolates each test file in its own process. Avoids vitest worker-thread
    // scheduling deadlocks with vi.useFakeTimers() under Linux CI (the issue spreads from
    // popup tests to fetchTransport tests on threads pool but disappears with forks).
    pool: "forks",
  },
});
