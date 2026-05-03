import { useRef, useCallback } from "react";
import { subscribe } from "./postMessageBridge.js";

export type PopupConnectResult =
  | { status: "connected"; connectionId: string; slug: string }
  | { status: "cancelled" }
  | { status: "timeout" };

interface OpenOpts {
  /** Pre-opened popup window. If not provided, the hook will call window.open(url, ...). */
  popup?: Window;
  url: string;
  expectedOrigin: string;
  expectedSlug: string;
  /** Milliseconds before the popup is considered timed out. Defaults to 300_000 (5 min). */
  timeoutMs?: number;
}

interface UsePopupConnectResult {
  open(opts: OpenOpts): Promise<PopupConnectResult>;
  close(): void;
}

/** Imperative hook for the connect popup handshake.
 *  For advanced use when you need direct control over the popup lifecycle.
 */
export function usePopupConnect(): UsePopupConnectResult {
  const popupRef = useRef<Window | null>(null);
  const statusRef = useRef<"idle" | "open">("idle");

  const close = useCallback((): void => {
    if (popupRef.current && !popupRef.current.closed) {
      popupRef.current.close();
    }
    popupRef.current = null;
    statusRef.current = "idle";
  }, []);

  const open = useCallback((opts: OpenOpts): Promise<PopupConnectResult> => {
    const { url, expectedOrigin, expectedSlug, timeoutMs = 300_000 } = opts;

    // Use a pre-opened popup if provided; otherwise open a new one
    const popup = opts.popup ?? window.open(url, "vendo-connect", "width=480,height=720,popup");

    if (!popup) {
      return Promise.resolve({ status: "cancelled" });
    }

    popupRef.current = popup;
    statusRef.current = "open";

    return new Promise<PopupConnectResult>((resolve) => {
      let settled = false;

      function settle(result: PopupConnectResult): void {
        if (settled) return;
        settled = true;
        clearInterval(pollId);
        clearTimeout(timeoutId);
        unsubscribe();
        popupRef.current = null;
        statusRef.current = "idle";
        resolve(result);
      }

      const unsubscribe = subscribe(
        (data) => {
          settle({ status: "connected", connectionId: data.connectionId, slug: data.slug });
        },
        { expectedOrigin, expectedSlug },
      );

      // Poll every 500ms to detect popup closed before completion
      const pollId = setInterval(() => {
        if (popup.closed) settle({ status: "cancelled" });
      }, 500);

      const timeoutId = setTimeout(() => {
        if (!popup.closed) popup.close();
        settle({ status: "timeout" });
      }, timeoutMs);
    });
  }, []);

  return { open, close };
}
