import { createContext } from "react";
import type { Connection, Integration, Balance, SpendCaps } from "@vendodev/sdk";

export interface PortalState {
  connections: Connection[];
  integrations: Integration[];
  balance: Balance | null;
  caps: SpendCaps | null;
  /**
   * Overall portal status. Gates the grid skeleton — flips to "ready" the
   * moment the integration catalog lands, even if connections/billing are
   * still in flight (see VendoProvider's optimistic loading).
   */
  status: "loading" | "ready" | "error";
  /**
   * Connections-list-specific status. Cards use this to decide whether to
   * show a spinner on the connect/manage button while the server-side
   * Composio credential fan-out is still resolving. Separate from `status`
   * so the integration catalog can render immediately.
   */
  connectionsStatus: "loading" | "ready" | "error";
  error: Error | null;
}

export interface PortalContextValue extends PortalState {
  /** Replaces or inserts a connection in the cache. */
  upsertConnection(conn: Connection): void;
  /** Removes a connection from the cache by slug. */
  dropConnection(slug: string): void;
  /** Replaces the balance in the cache. */
  setBalance(b: Balance): void;
  /** Replaces the spend-caps in the cache. */
  setCaps(c: SpendCaps): void;

  // Internal wiring set by VendoProvider — not part of the public surface but
  // needed by useConnect to call the client without importing it directly.

  /** @internal Build a connect URL for the given slug. */
  _connectUrl(slug: string, opts?: { returnTo?: string; state?: string }): string;
  /** @internal Base URL of the API (used to derive the expected postMessage origin). */
  _baseUrl: string;
  /** @internal Disconnect a connection by ID (only present if client.disconnect is defined). */
  _disconnect?: (connectionId: string) => Promise<void>;
  /** @internal Fetch latest connection data for a given slug from the client. */
  _refetchConnection(slug: string): Promise<import("@vendodev/sdk").Connection | null>;
}

export const PortalContext = createContext<PortalContextValue | null>(null);

export class VendoProviderMissingError extends Error {
  constructor(hookName: string) {
    super(`${hookName} must be used inside <VendoProvider>.`);
    this.name = "VendoProviderMissingError";
  }
}
