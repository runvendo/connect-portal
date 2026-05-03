import { useContext, useRef, useCallback } from "react";
import type { Connection } from "@vendodev/sdk";
import { PortalContext, VendoProviderMissingError } from "../context.js";
import { usePopupConnect } from "../popup/usePopupConnect.js";
import { expectedOrigin } from "../popup/postMessageBridge.js";

export type ConnectResult =
  /** connection holds the freshly-refetched server state after a successful connect. */
  | { status: "connected"; connectionId?: string; connection?: Connection }
  | { status: "cancelled" }
  | { status: "timeout" }
  /** Returned when the popup was blocked — the page is now navigating away via redirect. */
  | { status: "redirect_initiated" };

interface UseConnectResult {
  /** Opens the connect flow for the given integration slug.
   *  Opens a popup; falls back to full-page redirect if the popup is blocked.
   */
  connect(slug: string, opts?: { returnTo?: string; state?: string }): Promise<ConnectResult>;
  /** Disconnects the integration by connectionId.
   *  Requires `client.disconnect` to be implemented; throws otherwise.
   */
  disconnect(connectionId: string): Promise<void>;
}

export function useConnect(): UseConnectResult {
  const ctx = useContext(PortalContext);
  if (!ctx) throw new VendoProviderMissingError("useConnect");

  const popupHook = usePopupConnect();
  const ctxRef = useRef(ctx);
  ctxRef.current = ctx;

  const connect = useCallback(async (
    slug: string,
    opts?: { returnTo?: string; state?: string },
  ): Promise<ConnectResult> => {
    const { _connectUrl, _baseUrl } = ctxRef.current;
    const returnTo = opts?.returnTo ?? window.location.href;
    const url = _connectUrl(slug, { returnTo, state: opts?.state });
    const origin = expectedOrigin(_baseUrl);

    // Open popup first so we can detect if it was blocked (returns null)
    const popupWindow = window.open(url, "vendo-connect", "width=480,height=720,popup");

    if (!popupWindow) {
      // Popup blocked — fall back to full-page redirect
      window.location.assign(url);
      return { status: "redirect_initiated" };
    }

    // Hand the opened popup to the bridge hook
    const result = await popupHook.open({
      popup: popupWindow,
      url,
      expectedOrigin: origin,
      expectedSlug: slug,
    });

    if (result.status === "connected") {
      // Belt-and-suspenders refetch: SSE will also deliver the update, but on
      // hosts where SSE is degraded we need an explicit pull to stay consistent.
      // Wrap in try/catch so a refetch failure doesn't downgrade the connected result.
      let updated: Connection | null | undefined;
      try {
        updated = await ctxRef.current._refetchConnection(slug);
        if (updated) ctxRef.current.upsertConnection(updated);
      } catch (err) {
        console.warn("[useConnect] refetch after connect failed — SSE will catch up:", err);
      }
      return { status: "connected", connectionId: result.connectionId, connection: updated ?? undefined };
    }

    return result;
  }, [popupHook]);

  const disconnect = useCallback(async (connectionId: string): Promise<void> => {
    const { _disconnect } = ctxRef.current;

    if (_disconnect) {
      await _disconnect(connectionId);
      return;
    }

    throw new Error(
      "disconnect() requires the client to implement a disconnect(connectionId) method. " +
        "See the @vendodev/connect-portal README for details.",
    );
  }, []);

  return { connect, disconnect };
}
