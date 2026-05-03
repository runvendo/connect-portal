import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { usePopupConnect } from "../../src/popup/usePopupConnect.js";

// A fake popup object with a controllable closed flag
function makeFakePopup() {
  let closed = false;
  return {
    get closed() { return closed; },
    close() { closed = true; },
    _forceClose() { closed = true; },
  };
}

describe("usePopupConnect", () => {
  let fakePopup: ReturnType<typeof makeFakePopup>;
  let dispatchedListeners: Array<(event: MessageEvent) => void>;

  beforeEach(() => {
    fakePopup = makeFakePopup();
    dispatchedListeners = [];

    vi.spyOn(window, "open").mockReturnValue(fakePopup as unknown as Window);

    vi.spyOn(window, "addEventListener").mockImplementation(
      (type: string, handler: EventListenerOrEventListenerObject) => {
        if (type === "message") {
          dispatchedListeners.push(handler as (event: MessageEvent) => void);
        }
      }
    );

    vi.spyOn(window, "removeEventListener").mockImplementation(() => {});

    // Fake timers are opt-in per test below. The "connected" path resolves
    // synchronously via postMessage and deadlocked under fake-timers + happy-dom +
    // React 19 on Linux/Node 18 (passed only on macOS) — we use real timers there
    // and only enable fake timers in the popup-poll / timeout-driven tests.
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("resolves { status: connected } on valid postMessage", async () => {
    const { result } = renderHook(() => usePopupConnect());

    let openPromise: Promise<unknown>;
    act(() => {
      openPromise = result.current.open({
        url: "https://vendo.run/connect/telegram",
        expectedOrigin: "https://vendo.run",
        expectedSlug: "telegram",
      });
    });

    // Simulate the popup sending a valid postMessage
    await act(async () => {
      for (const listener of dispatchedListeners) {
        listener({
          origin: "https://vendo.run",
          data: { type: "vendo:connection-completed", slug: "telegram", connectionId: "conn_abc" },
        } as unknown as MessageEvent);
      }
    });

    const res = await openPromise!;
    expect(res).toEqual({ status: "connected", connectionId: "conn_abc", slug: "telegram" });
  });

  it("ignores postMessage from wrong origin (does not resolve or reject)", async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => usePopupConnect());

    let openPromise: Promise<unknown>;
    act(() => {
      openPromise = result.current.open({
        url: "https://vendo.run/connect/telegram",
        expectedOrigin: "https://vendo.run",
        expectedSlug: "telegram",
      });
    });

    // Simulate origin mismatch — should be silently ignored
    await act(async () => {
      for (const listener of dispatchedListeners) {
        listener({
          origin: "https://evil.com",
          data: { type: "vendo:connection-completed", slug: "telegram", connectionId: "conn_abc" },
        } as unknown as MessageEvent);
      }
    });

    // Now close the popup; the popup-closed poll fires within 500ms and resolves cancelled.
    fakePopup._forceClose();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(600);
    });

    const res = await openPromise!;
    // Should have resolved as cancelled (popup closed), not connected
    expect(res).toEqual({ status: "cancelled" });
  });

  it("resolves { status: cancelled } when popup is closed before completion", async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => usePopupConnect());

    let openPromise: Promise<unknown>;
    act(() => {
      openPromise = result.current.open({
        url: "https://vendo.run/connect/telegram",
        expectedOrigin: "https://vendo.run",
        expectedSlug: "telegram",
      });
    });

    fakePopup._forceClose();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(600);
    });

    const res = await openPromise!;
    expect(res).toEqual({ status: "cancelled" });
  });

  it("resolves { status: timeout } and closes the popup on timeout", async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => usePopupConnect());

    let openPromise: Promise<unknown>;
    act(() => {
      openPromise = result.current.open({
        url: "https://vendo.run/connect/telegram",
        expectedOrigin: "https://vendo.run",
        expectedSlug: "telegram",
        timeoutMs: 5000,
      });
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(6000);
    });

    const res = await openPromise!;
    expect(res).toEqual({ status: "timeout" });
    expect(fakePopup.closed).toBe(true);
  });

  it("produces no console.error when the component unmounts while a popup is open", async () => {
    vi.useFakeTimers();
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const { result, unmount } = renderHook(() => usePopupConnect());

    act(() => {
      // Start an open that will never complete on its own
      result.current.open({
        url: "https://vendo.run/connect/telegram",
        expectedOrigin: "https://vendo.run",
        expectedSlug: "telegram",
        timeoutMs: 60_000,
      });
    });

    // Unmount mid-flight — close() should cancel interval, timeout, and listener
    act(() => {
      result.current.close();
      unmount();
    });

    // Advance timers well past the timeout to confirm nothing fires after cleanup
    await act(async () => {
      await vi.advanceTimersByTimeAsync(70_000);
    });

    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
