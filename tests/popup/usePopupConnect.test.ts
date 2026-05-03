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

/**
 * Send a real `message` event through the document so the package's window
 * listener fires naturally. This avoids spying on addEventListener (which
 * caused fake-timer + happy-dom + React 19 deadlocks under Linux CI).
 */
function postFakeMessage(opts: { origin: string; data: unknown }): void {
  // happy-dom's MessageEvent ignores `origin` from the constructor, so set it
  // explicitly via Object.defineProperty after construction.
  const event = new MessageEvent("message", { data: opts.data });
  Object.defineProperty(event, "origin", { value: opts.origin });
  window.dispatchEvent(event);
}

describe("usePopupConnect", () => {
  let fakePopup: ReturnType<typeof makeFakePopup>;
  let renderedHooks: Array<{ unmount: () => void }> = [];

  beforeEach(() => {
    fakePopup = makeFakePopup();
    renderedHooks = [];
    vi.spyOn(window, "open").mockReturnValue(fakePopup as unknown as Window);
  });

  afterEach(() => {
    // Unmount any hooks the test forgot to clean up — frees their interval/timeout
    // refs so vi.useRealTimers() doesn't hang waiting on pending fake timers.
    for (const h of renderedHooks) {
      try { h.unmount(); } catch { /* already unmounted */ }
    }
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("resolves { status: connected } on valid postMessage", async () => {
    const r = renderHook(() => usePopupConnect());
    renderedHooks.push(r);

    let openPromise: Promise<unknown> | undefined;
    act(() => {
      openPromise = r.result.current.open({
        url: "https://vendo.run/connect/telegram",
        expectedOrigin: "https://vendo.run",
        expectedSlug: "telegram",
      });
    });

    await act(async () => {
      postFakeMessage({
        origin: "https://vendo.run",
        data: { type: "vendo:connection-completed", slug: "telegram", connectionId: "conn_abc" },
      });
    });

    const res = await openPromise;
    expect(res).toEqual({ status: "connected", connectionId: "conn_abc", slug: "telegram" });
  });

  it("ignores postMessage from wrong origin (does not resolve or reject)", async () => {
    vi.useFakeTimers();
    const r = renderHook(() => usePopupConnect());
    renderedHooks.push(r);

    let openPromise: Promise<unknown> | undefined;
    act(() => {
      openPromise = r.result.current.open({
        url: "https://vendo.run/connect/telegram",
        expectedOrigin: "https://vendo.run",
        expectedSlug: "telegram",
      });
    });

    await act(async () => {
      postFakeMessage({
        origin: "https://evil.com",
        data: { type: "vendo:connection-completed", slug: "telegram", connectionId: "conn_abc" },
      });
    });

    // The wrong-origin message was silently dropped. Now close the popup so the
    // poll-closed interval fires and resolves cancelled.
    fakePopup._forceClose();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(600);
    });

    const res = await openPromise;
    expect(res).toEqual({ status: "cancelled" });
  });

  it("resolves { status: cancelled } when popup is closed before completion", async () => {
    vi.useFakeTimers();
    const r = renderHook(() => usePopupConnect());
    renderedHooks.push(r);

    let openPromise: Promise<unknown> | undefined;
    act(() => {
      openPromise = r.result.current.open({
        url: "https://vendo.run/connect/telegram",
        expectedOrigin: "https://vendo.run",
        expectedSlug: "telegram",
      });
    });

    fakePopup._forceClose();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(600);
    });

    const res = await openPromise;
    expect(res).toEqual({ status: "cancelled" });
  });

  it("resolves { status: timeout } and closes the popup on timeout", async () => {
    vi.useFakeTimers();
    const r = renderHook(() => usePopupConnect());
    renderedHooks.push(r);

    let openPromise: Promise<unknown> | undefined;
    act(() => {
      openPromise = r.result.current.open({
        url: "https://vendo.run/connect/telegram",
        expectedOrigin: "https://vendo.run",
        expectedSlug: "telegram",
        timeoutMs: 5000,
      });
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(6000);
    });

    const res = await openPromise;
    expect(res).toEqual({ status: "timeout" });
    expect(fakePopup.closed).toBe(true);
  });

  it("produces no console.error when the component unmounts while a popup is open", async () => {
    vi.useFakeTimers();
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const r = renderHook(() => usePopupConnect());
    renderedHooks.push(r);

    act(() => {
      r.result.current.open({
        url: "https://vendo.run/connect/telegram",
        expectedOrigin: "https://vendo.run",
        expectedSlug: "telegram",
        timeoutMs: 60_000,
      });
    });

    act(() => {
      r.result.current.close();
      r.unmount();
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(70_000);
    });

    expect(errorSpy).not.toHaveBeenCalled();
  });
});
